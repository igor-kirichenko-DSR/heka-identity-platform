// The signing-request channel (F07): 'heka-sign://?request_uri=<https URL>' -> JSON request -> signature posted back.
import type {
  FetchedSigningRequest,
  FetchLike,
  SiwePayload,
  SigningBranch,
  SigningKind,
  SigningRequest,
  SigningResponse,
  TypedDataPayload,
} from './types'

import { SigningRequestError } from '../errors'
import { isChainId } from '../utils'

export const SIGNING_SCHEME = 'heka-sign:'
export const SIGNING_REQUEST_VERSION = 1
export const SIGNING_FETCH_TIMEOUT_MS = 10_000
/** Characters, not bytes: fetch gives the text only. */
export const SIGNING_MAX_BODY_CHARS = 65_536

const REQUEST_URI_PARAM = 'request_uri'
const URL_PATTERN = /^(https?):\/\/([^/?#@\s]+)(?:[/?#]\S*)?$/i
const KINDS: readonly SigningKind[] = ['eip712', 'siwe', 'personal_sign']
const BRANCHES: readonly SigningBranch[] = ['payment', 'binding']
const HTTP_OK_MIN = 200
const HTTP_OK_MAX = 299

export interface SigningFetchOptions {
  fetch?: FetchLike
  timeoutMs?: number
  maxChars?: number
  /** Plain http is accepted only for local development. */
  allowHttp?: boolean
  now?: () => number
}

/** scheme://host[:port] in lower case, or undefined when the text is not an http(s) URL without credentials. */
export const originOf = (url: string): string | undefined => {
  const match = URL_PATTERN.exec(url)
  return match ? `${match[1].toLowerCase()}://${match[2].toLowerCase()}` : undefined
}

export const isSigningLink = (uri: string): boolean => uri.trim().toLowerCase().startsWith(`${SIGNING_SCHEME}//`)

const decode = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    throw new SigningRequestError('malformed-uri', 'The signing link is not correctly encoded')
  }
}

/** The request URL inside a heka-sign link. Exactly one request_uri parameter; https only unless allowHttp. */
export const parseSigningUri = (uri: string, allowHttp = false): string => {
  const text = uri.trim()
  if (!isSigningLink(text)) throw new SigningRequestError('malformed-uri', 'Not a signing link')
  const queryStart = text.indexOf('?')
  if (queryStart < 0) throw new SigningRequestError('malformed-uri', 'The signing link has no request_uri')
  const values: string[] = []
  for (const pair of text.slice(queryStart + 1).split('&')) {
    const separator = pair.indexOf('=')
    if (separator > 0 && decode(pair.slice(0, separator)) === REQUEST_URI_PARAM) {
      values.push(decode(pair.slice(separator + 1)))
    }
  }
  if (values.length !== 1) throw new SigningRequestError('malformed-uri', 'The signing link needs one request_uri')
  const requestUrl = values[0]
  if (!originOf(requestUrl)) throw new SigningRequestError('malformed-uri', 'request_uri is not a valid URL')
  assertSecure(requestUrl, allowHttp)
  return requestUrl
}

const assertSecure = (url: string, allowHttp: boolean): void => {
  if (url.toLowerCase().startsWith('https://')) return
  if (allowHttp) return
  throw new SigningRequestError('insecure-url', 'Only https requests are accepted')
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0

const invalid = (message: string): SigningRequestError => new SigningRequestError('invalid-request', message)

const optionalString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw invalid(`${key} must be a string`)
  return value
}

const readTypedData = (payload: unknown): TypedDataPayload => {
  if (!isRecord(payload)) throw invalid('payload must be an object')
  const { domain, types, primaryType, message } = payload
  if (!isRecord(domain) || !isRecord(types) || !isRecord(message) || !isNonEmptyString(primaryType)) {
    throw invalid('typed data needs domain, types, primaryType and message')
  }
  const checked: TypedDataPayload['types'] = {}
  for (const [name, fields] of Object.entries(types)) {
    if (!Array.isArray(fields)) throw invalid(`type ${name} must be a list of fields`)
    checked[name] = fields.map((field) => {
      if (!isRecord(field) || !isNonEmptyString(field.name) || !isNonEmptyString(field.type)) {
        throw invalid(`type ${name} has a malformed field`)
      }
      return { name: field.name, type: field.type }
    })
  }
  if (!(primaryType in checked)) throw invalid('primaryType is not in types')
  return { domain, types: checked, primaryType, message }
}

const readSiwe = (payload: unknown): SiwePayload => {
  if (!isRecord(payload)) throw invalid('payload must be an object')
  const { domain, uri, nonce, chainId, resources } = payload
  if (!isNonEmptyString(domain) || !isNonEmptyString(uri) || !isNonEmptyString(nonce)) {
    throw invalid('SIWE needs domain, uri and nonce')
  }
  if (typeof chainId !== 'number' || !Number.isSafeInteger(chainId) || chainId <= 0) {
    throw invalid('SIWE chainId must be a positive integer')
  }
  if (resources !== undefined && (!Array.isArray(resources) || !resources.every((r) => typeof r === 'string'))) {
    throw invalid('SIWE resources must be a list of strings')
  }
  return {
    domain,
    uri,
    nonce,
    chainId,
    address: optionalString(payload, 'address'),
    statement: optionalString(payload, 'statement'),
    issuedAt: optionalString(payload, 'issuedAt'),
    expirationTime: optionalString(payload, 'expirationTime'),
    notBefore: optionalString(payload, 'notBefore'),
    requestId: optionalString(payload, 'requestId'),
    resources: resources as string[] | undefined,
  }
}

const readNonce = (payload: unknown): { message: string } => {
  if (!isRecord(payload) || !isNonEmptyString(payload.message)) throw invalid('payload needs a message')
  return { message: payload.message }
}

const parseTime = (value: unknown, name: string): number => {
  const time = typeof value === 'string' ? Date.parse(value) : Number.NaN
  if (Number.isNaN(time)) throw invalid(`${name} is not an ISO 8601 time`)
  return time
}

/**
 * Checks the shape, the origin of response_uri and the expiry. Chain and content checks (SIWE domain, permit
 * shapes) belong to the chain adapter.
 */
export const validateSigningRequest = (
  json: unknown,
  requestUrl: string,
  { allowHttp = false, now = Date.now }: { allowHttp?: boolean; now?: () => number } = {}
): SigningRequest => {
  if (!isRecord(json)) throw invalid('The request is not a JSON object')
  if (json.version !== SIGNING_REQUEST_VERSION) throw invalid('Unsupported request version')
  const { id, kind, chain, branch, payload, response_uri: responseUri, expires_at: expiresAt } = json
  if (!isNonEmptyString(id)) throw invalid('id is missing')
  if (!KINDS.includes(kind as SigningKind)) throw invalid('Unknown kind')
  if (typeof chain !== 'string' || !isChainId(chain)) throw invalid('Unsupported chain')
  if (!BRANCHES.includes(branch as SigningBranch)) throw invalid('Unknown branch')
  if (!isNonEmptyString(responseUri)) throw invalid('response_uri is missing')
  assertSecure(responseUri, allowHttp)
  const responseOrigin = originOf(responseUri)
  if (!responseOrigin || responseOrigin !== originOf(requestUrl)) {
    throw new SigningRequestError('origin-mismatch', 'response_uri must have the origin of request_uri')
  }
  if (parseTime(expiresAt, 'expires_at') <= now()) throw new SigningRequestError('expired', 'The request has expired')

  const base = { version: SIGNING_REQUEST_VERSION, id, chain, branch: branch as SigningBranch, responseUri } as const
  const expires = expiresAt as string
  switch (kind as SigningKind) {
    case 'eip712':
      return { ...base, expiresAt: expires, kind: 'eip712', payload: readTypedData(payload) }
    case 'siwe':
      return { ...base, expiresAt: expires, kind: 'siwe', payload: readSiwe(payload) }
    default:
      return { ...base, expiresAt: expires, kind: 'personal_sign', payload: readNonce(payload) }
  }
}

const defaultFetch = (): FetchLike => {
  if (typeof fetch !== 'function') throw new SigningRequestError('network', 'No network client is available')
  return fetch as unknown as FetchLike
}

const withTimeout = async <T>(timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await run(controller.signal)
  } catch (error) {
    if (controller.signal.aborted) throw new SigningRequestError('network', 'The request timed out')
    if (error instanceof SigningRequestError) throw error
    throw new SigningRequestError('network', 'The request could not be fetched')
  } finally {
    clearTimeout(timer)
  }
}

/** GET the request, with a timeout and a size cap, and validate it. A redirect to another origin is refused. */
export const fetchSigningRequest = async (
  requestUrl: string,
  options: SigningFetchOptions = {}
): Promise<FetchedSigningRequest> => {
  const { timeoutMs = SIGNING_FETCH_TIMEOUT_MS, maxChars = SIGNING_MAX_BODY_CHARS, allowHttp = false } = options
  const origin = originOf(requestUrl)
  if (!origin) throw new SigningRequestError('malformed-uri', 'request_uri is not a valid URL')
  assertSecure(requestUrl, allowHttp)
  const doFetch = options.fetch ?? defaultFetch()
  const text = await withTimeout(timeoutMs, async (signal) => {
    const response = await doFetch(requestUrl, { method: 'GET', headers: { Accept: 'application/json' }, signal })
    if (response.url && originOf(response.url) !== origin) {
      throw new SigningRequestError('origin-mismatch', 'The request was served from another origin')
    }
    if (!response.ok) throw new SigningRequestError('network', `The server answered ${response.status}`)
    const body = await response.text()
    if (body.length > maxChars) throw new SigningRequestError('too-large', 'The request is too large')
    return body
  })
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw invalid('The request is not valid JSON')
  }
  const request = validateSigningRequest(json, requestUrl, { allowHttp, now: options.now })
  return { request, requestUrl, origin }
}

/** POST the signature to response_uri; a non-2xx answer fails. */
export const postSigningResponse = async (
  request: SigningRequest,
  response: SigningResponse,
  options: Pick<SigningFetchOptions, 'fetch' | 'timeoutMs' | 'allowHttp'> = {}
): Promise<void> => {
  const { timeoutMs = SIGNING_FETCH_TIMEOUT_MS, allowHttp = false } = options
  assertSecure(request.responseUri, allowHttp)
  const doFetch = options.fetch ?? defaultFetch()
  await withTimeout(timeoutMs, async (signal) => {
    const answer = await doFetch(request.responseUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
      signal,
    })
    if (answer.url && originOf(answer.url) !== originOf(request.responseUri)) {
      throw new SigningRequestError('origin-mismatch', 'The answer came from another origin')
    }
    if (answer.status < HTTP_OK_MIN || answer.status > HTTP_OK_MAX) {
      throw new SigningRequestError('network', `The server answered ${answer.status}`)
    }
  })
}
