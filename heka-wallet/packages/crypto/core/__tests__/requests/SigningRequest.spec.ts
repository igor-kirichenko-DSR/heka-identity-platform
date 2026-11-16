import {
  fetchSigningRequest,
  isSigningLink,
  originOf,
  parseSigningUri,
  postSigningResponse,
  SigningRequestError,
  validateSigningRequest,
  type FetchLike,
  type SigningRequest,
} from '../../src'

const REQUEST_URL = 'https://rp.example.com/sign/abc'
const NOW = Date.parse('2026-11-13T10:00:00Z')
const FUTURE = '2026-11-13T10:05:00Z'
const PAST = '2026-11-13T09:00:00Z'

const base = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  version: 1,
  id: 'req-1',
  kind: 'personal_sign',
  chain: 'eip155:84532',
  branch: 'binding',
  payload: { message: 'nonce-123' },
  response_uri: 'https://rp.example.com/sign/abc/response',
  expires_at: FUTURE,
  ...extra,
})

const typedData = {
  domain: { name: 'Login', version: '1', chainId: 84532 },
  types: { Login: [{ name: 'nonce', type: 'string' }] },
  primaryType: 'Login',
  message: { nonce: 'n1' },
}

const siwe = {
  domain: 'rp.example.com',
  uri: 'https://rp.example.com/login',
  chainId: 84532,
  nonce: 'abcdefgh',
  statement: 'Sign in',
}

const validate = (json: unknown, url = REQUEST_URL) => validateSigningRequest(json, url, { now: () => NOW })

const codeOf = (run: () => unknown): string | undefined => {
  try {
    run()
  } catch (error) {
    return error instanceof SigningRequestError ? error.code : 'other'
  }
  return undefined
}

describe('parseSigningUri', () => {
  const link = (url: string) => `heka-sign://?request_uri=${encodeURIComponent(url)}`

  it('reads the https request URL', () => {
    expect(parseSigningUri(link(REQUEST_URL))).toBe(REQUEST_URL)
  })

  it('recognises a signing link by its scheme only', () => {
    expect(isSigningLink(' HEKA-SIGN://?request_uri=x')).toBe(true)
    expect(isSigningLink('ethereum:0xabc')).toBe(false)
  })

  it('refuses http unless development allows it', () => {
    expect(codeOf(() => parseSigningUri(link('http://rp.example.com/s')))).toBe('insecure-url')
    expect(parseSigningUri(link('http://10.0.2.2:8080/s'), true)).toBe('http://10.0.2.2:8080/s')
  })

  it('refuses a link without request_uri or with two', () => {
    expect(codeOf(() => parseSigningUri('heka-sign://'))).toBe('malformed-uri')
    expect(codeOf(() => parseSigningUri('heka-sign://?other=1'))).toBe('malformed-uri')
    const twice = `${link(REQUEST_URL)}&request_uri=${encodeURIComponent('https://evil.example/x')}`
    expect(codeOf(() => parseSigningUri(twice))).toBe('malformed-uri')
  })

  it('refuses credentials in the URL and bad percent-encoding', () => {
    expect(codeOf(() => parseSigningUri(link('https://user:pw@rp.example.com/s')))).toBe('malformed-uri')
    expect(codeOf(() => parseSigningUri('heka-sign://?request_uri=%E0%A4%A'))).toBe('malformed-uri')
  })
})

describe('originOf', () => {
  it('lower-cases scheme and host and keeps the port', () => {
    expect(originOf('HTTPS://RP.Example.com:8443/a?b#c')).toBe('https://rp.example.com:8443')
  })

  it('returns undefined for credentials or a non-http scheme', () => {
    expect(originOf('https://u@rp.example.com/')).toBeUndefined()
    expect(originOf('ftp://rp.example.com/')).toBeUndefined()
  })
})

describe('validateSigningRequest', () => {
  it('accepts a nonce request', () => {
    const request = validate(base())
    expect(request).toMatchObject({ kind: 'personal_sign', branch: 'binding', payload: { message: 'nonce-123' } })
  })

  it('accepts typed data', () => {
    expect(validate(base({ kind: 'eip712', payload: typedData })).kind).toBe('eip712')
  })

  it('accepts a SIWE request', () => {
    const request = validate(base({ kind: 'siwe', payload: siwe })) as Extract<SigningRequest, { kind: 'siwe' }>
    expect(request.payload.statement).toBe('Sign in')
  })

  it.each([
    ['unknown kind', { kind: 'eth_sign' }],
    ['unknown version', { version: 2 }],
    ['unknown branch', { branch: 'savings' }],
    ['bad chain', { chain: '84532' }],
    ['missing id', { id: '' }],
    ['bad expiry', { expires_at: 'tomorrow' }],
  ])('refuses %s', (_name, extra) => {
    expect(codeOf(() => validate(base(extra)))).toBe('invalid-request')
  })

  it('refuses an expired request', () => {
    expect(codeOf(() => validate(base({ expires_at: PAST })))).toBe('expired')
  })

  it('refuses a response_uri of another origin', () => {
    expect(codeOf(() => validate(base({ response_uri: 'https://evil.example.com/r' })))).toBe('origin-mismatch')
    expect(codeOf(() => validate(base({ response_uri: 'https://rp.example.com:444/r' })))).toBe('origin-mismatch')
  })

  it('refuses a plain-http response_uri', () => {
    expect(codeOf(() => validate(base({ response_uri: 'http://rp.example.com/r' })))).toBe('insecure-url')
  })

  it('refuses wrong payload shapes', () => {
    expect(codeOf(() => validate(base({ payload: {} })))).toBe('invalid-request')
    expect(codeOf(() => validate(base({ kind: 'eip712', payload: { ...typedData, primaryType: 'Missing' } })))).toBe(
      'invalid-request'
    )
    expect(codeOf(() => validate(base({ kind: 'siwe', payload: { ...siwe, chainId: '84532' } })))).toBe(
      'invalid-request'
    )
    expect(codeOf(() => validate('text'))).toBe('invalid-request')
  })
})

const answer = (body: string, init: { ok?: boolean; status?: number; url?: string } = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  url: init.url,
  text: async () => body,
})

describe('fetchSigningRequest', () => {
  const opts = { now: () => NOW }

  it('returns the validated request with its origin', async () => {
    const fetch: FetchLike = async () => answer(JSON.stringify(base()))
    const result = await fetchSigningRequest(REQUEST_URL, { ...opts, fetch })
    expect(result.origin).toBe('https://rp.example.com')
    expect(result.request.id).toBe('req-1')
  })

  it('refuses a body above the cap', async () => {
    const fetch: FetchLike = async () => answer(JSON.stringify(base()))
    await expect(fetchSigningRequest(REQUEST_URL, { ...opts, fetch, maxChars: 10 })).rejects.toMatchObject({
      code: 'too-large',
    })
  })

  it('refuses a redirect to another origin', async () => {
    const fetch: FetchLike = async () => answer(JSON.stringify(base()), { url: 'https://evil.example.com/x' })
    await expect(fetchSigningRequest(REQUEST_URL, { ...opts, fetch })).rejects.toMatchObject({
      code: 'origin-mismatch',
    })
  })

  it('refuses a non-JSON body and an HTTP error', async () => {
    await expect(
      fetchSigningRequest(REQUEST_URL, { ...opts, fetch: async () => answer('<html>') })
    ).rejects.toMatchObject({ code: 'invalid-request' })
    await expect(
      fetchSigningRequest(REQUEST_URL, { ...opts, fetch: async () => answer('', { ok: false, status: 404 }) })
    ).rejects.toMatchObject({ code: 'network' })
  })

  it('times out when the server does not answer', async () => {
    const fetch: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))))
    await expect(fetchSigningRequest(REQUEST_URL, { ...opts, fetch, timeoutMs: 20 })).rejects.toMatchObject({
      code: 'network',
      message: 'The request timed out',
    })
  })

  it('refuses a plain-http URL unless development allows it', async () => {
    const fetch: FetchLike = async () => answer('{}')
    await expect(fetchSigningRequest('http://rp.example.com/s', { fetch })).rejects.toMatchObject({
      code: 'insecure-url',
    })
  })
})

describe('postSigningResponse', () => {
  const request = validate(base())
  const response = { id: 'req-1', address: '0xabc', signature: '0xsig' }

  it('posts the response as JSON to response_uri', async () => {
    const calls: Array<{ url: string; body?: string; method: string }> = []
    const fetch: FetchLike = async (url, init) => {
      calls.push({ url, body: init.body, method: init.method })
      return answer('', { status: 204 })
    }
    await postSigningResponse(request, response, { fetch })
    expect(calls).toEqual([{ url: request.responseUri, method: 'POST', body: JSON.stringify(response) }])
  })

  it('fails on a non-2xx answer', async () => {
    const fetch: FetchLike = async () => answer('', { ok: false, status: 400 })
    await expect(postSigningResponse(request, response, { fetch })).rejects.toMatchObject({ code: 'network' })
  })

  it('fails when the answer comes from another origin', async () => {
    const fetch: FetchLike = async () => answer('', { url: 'https://evil.example.com/r' })
    await expect(postSigningResponse(request, response, { fetch })).rejects.toMatchObject({ code: 'origin-mismatch' })
  })
})
