import type { ChainId } from '../types'

export type SigningKind = 'eip712' | 'siwe' | 'personal_sign'

/** Which derivation branch signs: the payment account or the binding account. */
export type SigningBranch = 'payment' | 'binding'

export interface TypedDataPayload {
  domain: Record<string, unknown>
  types: Record<string, Array<{ name: string; type: string }>>
  primaryType: string
  message: Record<string, unknown>
}

/** EIP-4361 fields; `version` is always '1'. Times are ISO 8601 strings. */
export interface SiwePayload {
  domain: string
  address?: string
  statement?: string
  uri: string
  chainId: number
  nonce: string
  issuedAt?: string
  expirationTime?: string
  notBefore?: string
  requestId?: string
  resources?: string[]
}

export interface NoncePayload {
  message: string
}

interface SigningRequestBase {
  version: 1
  id: string
  chain: ChainId
  branch: SigningBranch
  /** The https URL the response goes to; same origin as the request URL. */
  responseUri: string
  /** ISO 8601. */
  expiresAt: string
}

export type SigningRequest = SigningRequestBase &
  (
    | { kind: 'eip712'; payload: TypedDataPayload }
    | { kind: 'siwe'; payload: SiwePayload }
    | { kind: 'personal_sign'; payload: NoncePayload }
  )

/** What the wallet posts back. */
export interface SigningResponse {
  id: string
  address: string
  signature: string
}

/** A request read from the network plus the URL it came from (the origin the holder sees). */
export interface FetchedSigningRequest {
  request: SigningRequest
  requestUrl: string
  /** scheme://host[:port] of the request URL. */
  origin: string
}

/** The part of fetch the channel uses, so tests and the app inject their own. */
export interface FetchResponseLike {
  ok: boolean
  status: number
  url?: string
  text(): Promise<string>
}

export type FetchLike = (
  url: string,
  init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: string; signal?: AbortSignal }
) => Promise<FetchResponseLike>
