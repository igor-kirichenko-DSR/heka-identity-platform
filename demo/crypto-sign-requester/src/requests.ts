// The relying party side of the heka-sign channel: builds a signing request and verifies the wallet's answer.
import { type Address, type Hex, verifyMessage, verifyTypedData } from 'viem'
import { createSiweMessage, validateSiweMessage } from 'viem/siwe'

export type Kind = 'eip712' | 'siwe' | 'personal_sign'
export type Branch = 'payment' | 'binding'

export interface SigningRequestJson {
  version: 1
  id: string
  kind: Kind
  chain: string
  branch: Branch
  payload: Record<string, unknown>
  response_uri: string
  expires_at: string
}

export interface WalletResponse {
  id: string
  address: string
  signature: string
}

export interface BuildOptions {
  id: string
  kind: Kind
  branch: Branch
  chain: string
  /** Where the wallet reaches this server, e.g. the host LAN address, or http://10.0.2.2:8787 from an Android emulator. */
  baseUrl: string
  now?: number
  ttlMs?: number
}

const DEFAULT_TTL_MS = 5 * 60 * 1000
const ISSUED_AT_SKEW_MS = 1000

const chainNumber = (chain: string): number => Number(chain.split(':')[1])

const hostOf = (baseUrl: string): string => new URL(baseUrl).host

/** The nonce the wallet signs; derived from the id so the server can recompute it. */
export const nonceFor = (id: string): string => `nonce-${id}`

export const typedDataFor = (id: string, chain: string) => ({
  domain: { name: 'Heka Demo Login', version: '1', chainId: chainNumber(chain) },
  types: {
    Login: [
      { name: 'requestId', type: 'string' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  primaryType: 'Login' as const,
  // Integers travel as decimal strings in JSON; the wallet revives them to bigint.
  message: { requestId: id, amount: '1' },
})

export const buildRequest = ({
  id,
  kind,
  branch,
  chain,
  baseUrl,
  now = Date.now(),
  ttlMs = DEFAULT_TTL_MS,
}: BuildOptions): SigningRequestJson => {
  const issuedAt = new Date(now - ISSUED_AT_SKEW_MS).toISOString()
  const payloads: Record<Kind, Record<string, unknown>> = {
    personal_sign: { message: nonceFor(id) },
    eip712: typedDataFor(id, chain),
    siwe: {
      domain: hostOf(baseUrl),
      uri: `${baseUrl}/login`,
      chainId: chainNumber(chain),
      nonce: id.replace(/[^a-zA-Z0-9]/g, '').padEnd(8, '0'),
      statement: 'Sign in to the Heka demo requester',
      issuedAt,
    },
  }
  return {
    version: 1,
    id,
    kind,
    chain,
    branch,
    payload: payloads[kind],
    response_uri: `${baseUrl}/requests/${encodeURIComponent(id)}/response`,
    expires_at: new Date(now + ttlMs).toISOString(),
  }
}

export interface Verdict {
  valid: boolean
  reason?: string
}

/** Checks the wallet's answer against the request it was given. Never trusts the address field alone. */
export const verifyResponse = async (
  request: SigningRequestJson,
  response: WalletResponse,
  now: number = Date.now()
): Promise<Verdict> => {
  if (response.id !== request.id) return { valid: false, reason: 'id mismatch' }
  const address = response.address as Address
  const signature = response.signature as Hex
  try {
    switch (request.kind) {
      case 'personal_sign':
        return verdict(await verifyMessage({ address, message: nonceFor(request.id), signature }))
      case 'eip712': {
        const data = typedDataFor(request.id, request.chain)
        const ok = await verifyTypedData({
          address,
          signature,
          domain: data.domain,
          types: data.types,
          primaryType: data.primaryType,
          message: { requestId: request.id, amount: BigInt(1) },
        })
        return verdict(ok)
      }
      case 'siwe': {
        const payload = request.payload as unknown as {
          domain: string
          uri: string
          chainId: number
          nonce: string
          statement: string
          issuedAt: string
        }
        const message = {
          address,
          chainId: payload.chainId,
          domain: payload.domain,
          nonce: payload.nonce,
          uri: payload.uri,
          version: '1' as const,
          statement: payload.statement,
          issuedAt: new Date(payload.issuedAt),
        }
        const text = createSiweMessage(message)
        const fresh = validateSiweMessage({
          message,
          domain: payload.domain,
          nonce: payload.nonce,
          time: new Date(now),
        })
        if (!fresh) return { valid: false, reason: 'SIWE message is not valid' }
        return verdict(await verifyMessage({ address, message: text, signature }))
      }
    }
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : 'verification failed' }
  }
}

const verdict = (ok: boolean): Verdict => (ok ? { valid: true } : { valid: false, reason: 'signature does not match' })
