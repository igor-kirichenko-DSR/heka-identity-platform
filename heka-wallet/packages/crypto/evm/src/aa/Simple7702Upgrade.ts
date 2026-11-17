import type { Address, Client, LocalAccount, PrivateKeyAccount, SignAuthorizationReturnType } from 'viem'

import { ForeignDelegationError } from '@heka-wallet/crypto-core'
import { getAddress, toHex } from 'viem'
import { toSimple7702SmartAccount } from 'viem/account-abstraction'
import { privateKeyToAccount } from 'viem/accounts'
import { getCode, getTransactionCount } from 'viem/actions'

import { EvmAdapterError } from '../errors'

// EIP-7702: an account delegated to a contract has the code 0xef0100 followed by the contract's 20-byte address
const DELEGATION_PREFIX = '0xef0100'

/** The client type viem's Simple7702 account accepts. */
export type AaClient = Parameters<typeof toSimple7702SmartAccount>[0]['client']

export type Delegation = 'none' | 'pinned' | 'foreign'

/** Reads the account's code: no code, a delegation to the pinned implementation, or anything else. */
export const readDelegation = async (client: Client, account: Address, pinned: Address): Promise<Delegation> => {
  const code = await getCode(client, { address: account })
  if (code === undefined || code === '0x') return 'none'
  if (code.toLowerCase() === `${DELEGATION_PREFIX}${pinned.slice(2)}`.toLowerCase()) return 'pinned'
  return 'foreign'
}

/** viem's Simple7702 account needs a private-key account; an HD account is converted inside the key scope. */
export const toPrivateKeyOwner = (account: LocalAccount): PrivateKeyAccount => {
  if ('getHdKey' in account && typeof account.getHdKey === 'function') {
    const { privateKey } = (account as LocalAccount & { getHdKey: () => { privateKey: Uint8Array | null } }).getHdKey()
    if (!privateKey) throw new EvmAdapterError('The payment key has no private key')
    return privateKeyToAccount(toHex(privateKey))
  }
  if ('sign' in account && typeof account.sign === 'function') return account as PrivateKeyAccount
  throw new EvmAdapterError('The payment key cannot sign a 7702 authorization')
}

export interface Simple7702 {
  account: Awaited<ReturnType<typeof toSimple7702SmartAccount>>
  /** Only on first use: the owner's signed delegation to the pinned implementation. */
  authorization?: SignAuthorizationReturnType
  /** True when the account was already delegated to the pinned implementation. */
  delegated: boolean
}

/**
 * The smart account at the EOA's own address, delegated to the pinned implementation only.
 * Refuses a foreign delegation; signs the authorization when there is none yet.
 */
export const prepareSimple7702 = async (params: {
  client: AaClient
  owner: PrivateKeyAccount
  implementation: Address
  chainId: number
}): Promise<Simple7702> => {
  const { client, owner, chainId } = params
  const implementation = getAddress(params.implementation)
  const delegation = await readDelegation(client, owner.address, implementation)
  if (delegation === 'foreign') {
    throw new ForeignDelegationError(`${owner.address} is delegated to a contract other than ${implementation}`)
  }
  const account = await toSimple7702SmartAccount({ client, owner, implementation })
  if (delegation === 'pinned') return { account, delegated: true }
  const nonce = await getTransactionCount(client, { address: owner.address })
  const authorization = await owner.signAuthorization({ chainId, nonce, address: implementation })
  return { account, authorization, delegated: false }
}
