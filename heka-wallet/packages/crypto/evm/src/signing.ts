// Signing requests (F07): EIP-712 typed data, SIWE (EIP-4361) and a plain message (EIP-191), after the checks that
// keep a relying party from turning a login into an allowance or a signature for another site or chain.
import type { KeyProvider, AuthProof, SignedRequest, SigningRequest } from '@heka-wallet/crypto-core'
import type { Address, LocalAccount } from 'viem'

import { originOf, SigningRequestError } from '@heka-wallet/crypto-core'
import { getAddress } from 'viem'
import { createSiweMessage } from 'viem/siwe'

import { type EvmChainConfig, evmChainId } from './types'

/** Any type name or primary type containing this is an allowance in disguise (Permit, Permit2, PermitSingle ...). */
const PERMIT_PATTERN = /permit/i
const INTEGER_TYPE = /^u?int\d*$/
const ARRAY_TYPE = /^(.*)\[\d*\]$/
const FIRST_ACCOUNT = 0

type TypedData = Extract<SigningRequest, { kind: 'eip712' }>['payload']
type Siwe = Extract<SigningRequest, { kind: 'siwe' }>['payload']

const refuse = (code: ConstructorParameters<typeof SigningRequestError>[0], message: string): never => {
  throw new SigningRequestError(code, message)
}

const hostOf = (requestUrl: string): string => {
  const origin = originOf(requestUrl)
  return origin ? origin.slice(origin.indexOf('://') + '://'.length) : ''
}

const toBigInt = (value: unknown): bigint | undefined => {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value)
  if (typeof value === 'string' && /^(0x[0-9a-fA-F]+|\d+)$/.test(value)) return BigInt(value)
  return undefined
}

const parseTime = (value: string, name: string): Date => {
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return refuse('invalid-request', `${name} is not an ISO 8601 time`)
  return time
}

/** A typed-data permit, or one that targets a token of this chain, must never be signed for a relying party. */
export const assertNotPermit = (typedData: TypedData, config: EvmChainConfig): void => {
  const names = [typedData.primaryType, ...Object.keys(typedData.types)]
  if (names.some((name) => PERMIT_PATTERN.test(name))) {
    refuse('permit-refused', 'This message would approve spending of tokens and cannot be signed for a request')
  }
  const target = typedData.domain.verifyingContract
  if (typeof target === 'string') {
    const isToken = config.descriptor.assets.some(
      (asset) => asset.address !== undefined && asset.address.toLowerCase() === target.toLowerCase()
    )
    if (isToken) refuse('permit-refused', 'This message is addressed to a token contract and cannot be signed')
  }
}

const assertTypedData = (typedData: TypedData, config: EvmChainConfig): void => {
  const chainId = toBigInt(typedData.domain.chainId)
  if (chainId === undefined || chainId !== BigInt(evmChainId(config))) {
    refuse('chain-mismatch', 'The message domain is for another chain')
  }
  assertNotPermit(typedData, config)
}

const assertSiwe = (siwe: Siwe, config: EvmChainConfig, requestUrl: string, now: number): void => {
  if (siwe.chainId !== evmChainId(config)) refuse('chain-mismatch', 'The sign-in message is for another chain')
  if (siwe.domain.toLowerCase() !== hostOf(requestUrl)) {
    refuse('siwe-domain', 'The sign-in message names another site than the one that asked')
  }
  if (siwe.issuedAt === undefined) refuse('invalid-request', 'The sign-in message has no issuedAt')
  if (siwe.expirationTime !== undefined && parseTime(siwe.expirationTime, 'expirationTime').getTime() <= now) {
    refuse('expired', 'The sign-in message has expired')
  }
  if (siwe.notBefore !== undefined && parseTime(siwe.notBefore, 'notBefore').getTime() > now) {
    refuse('invalid-request', 'The sign-in message is not valid yet')
  }
}

/** Chain and content checks; throws SigningRequestError. Nothing is signed here. */
export const checkEvmSigningRequest = (
  config: EvmChainConfig,
  request: SigningRequest,
  requestUrl: string,
  now: number = Date.now()
): void => {
  if (request.chain !== config.descriptor.id) refuse('chain-mismatch', 'The request is for another chain')
  switch (request.kind) {
    case 'eip712':
      return assertTypedData(request.payload, config)
    case 'siwe':
      return assertSiwe(request.payload, config, requestUrl, now)
    default:
      return
  }
}

/** JSON numbers and strings become bigint where the type is an integer, as viem's encoder requires. */
const reviveValue = (type: string, value: unknown, types: TypedData['types']): unknown => {
  const array = ARRAY_TYPE.exec(type)
  if (array) {
    if (!Array.isArray(value)) return refuse('invalid-request', 'An array field is not a list')
    return value.map((item) => reviveValue(array[1], item, types))
  }
  if (INTEGER_TYPE.test(type)) {
    const integer = toBigInt(value)
    return integer === undefined ? refuse('invalid-request', `A ${type} field is not an integer`) : integer
  }
  if (type in types) return reviveStruct(type, value, types)
  return value
}

const reviveStruct = (type: string, value: unknown, types: TypedData['types']): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return refuse('invalid-request', `A ${type} field is not an object`)
  }
  const record = value as Record<string, unknown>
  const revived: Record<string, unknown> = {}
  for (const field of types[type]) {
    if (record[field.name] !== undefined) revived[field.name] = reviveValue(field.type, record[field.name], types)
  }
  return revived
}

const signTypedData = (account: LocalAccount, typedData: TypedData): Promise<`0x${string}`> => {
  const { domain, types, primaryType, message } = typedData
  const chainId = toBigInt(domain.chainId)
  return account.signTypedData({
    domain: { ...domain, chainId: chainId === undefined ? undefined : Number(chainId) },
    types,
    primaryType,
    message: reviveStruct(primaryType, message, types),
  } as Parameters<LocalAccount['signTypedData']>[0])
}

/** The EIP-4361 text the relying party reconstructs from the same fields to verify the signature. */
export const buildSiweMessage = (siwe: Siwe, address: Address): string =>
  createSiweMessage({
    address,
    chainId: siwe.chainId,
    domain: siwe.domain,
    nonce: siwe.nonce,
    uri: siwe.uri,
    version: '1',
    statement: siwe.statement,
    issuedAt: siwe.issuedAt === undefined ? undefined : parseTime(siwe.issuedAt, 'issuedAt'),
    expirationTime: siwe.expirationTime === undefined ? undefined : parseTime(siwe.expirationTime, 'expirationTime'),
    notBefore: siwe.notBefore === undefined ? undefined : parseTime(siwe.notBefore, 'notBefore'),
    requestId: siwe.requestId,
    resources: siwe.resources,
  })

const signSiwe = (account: LocalAccount, siwe: Siwe): Promise<`0x${string}`> => {
  if (siwe.address !== undefined && getAddress(siwe.address) !== getAddress(account.address)) {
    return refuse('invalid-request', 'The sign-in message names another address than the one that signs')
  }
  return account.signMessage({ message: buildSiweMessage(siwe, getAddress(account.address)) })
}

/** The address the branch signs with, from the cached address record; the key stays closed. */
export const signingAddressFor = async (
  config: EvmChainConfig,
  request: SigningRequest,
  readAddress: (index: number, branch: SigningRequest['branch']) => Promise<string | undefined>
): Promise<string> => {
  const cached = await readAddress(FIRST_ACCOUNT, request.branch)
  if (cached === undefined) {
    return request.branch === 'binding'
      ? refuse('binding-unavailable', 'This wallet has no binding account (it was imported from a single key)')
      : refuse('unsupported', `No ${config.descriptor.id} account is available`)
  }
  return getAddress(cached)
}

/** Checks, then signs inside withAuthorizedAccount: the proof is consumed first and the key lives only in the callback. */
export const signEvmRequest = async (
  config: EvmChainConfig,
  request: SigningRequest,
  requestUrl: string,
  keys: KeyProvider,
  auth: AuthProof,
  now: number = Date.now()
): Promise<SignedRequest> => {
  checkEvmSigningRequest(config, request, requestUrl, now)
  return keys.withAuthorizedAccount(request.branch, FIRST_ACCOUNT, auth, async (account) => {
    const signature = await signWith(account, request)
    return { address: getAddress(account.address), signature }
  })
}

const signWith = (account: LocalAccount, request: SigningRequest): Promise<`0x${string}`> => {
  switch (request.kind) {
    case 'eip712':
      return signTypedData(account, request.payload)
    case 'siwe':
      return signSiwe(account, request.payload)
    default:
      return account.signMessage({ message: request.payload.message })
  }
}
