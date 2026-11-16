import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createSiweMessage } from 'viem/siwe'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

import { buildRequest, nonceFor, typedDataFor, verifyResponse, type Kind, type SigningRequestJson } from './requests'

const BASE_URL = 'http://10.0.2.2:8787'
const CHAIN = 'eip155:84532'
const NOW = Date.parse('2026-11-13T10:00:00Z')

const account = privateKeyToAccount(generatePrivateKey())

const make = (kind: Kind): SigningRequestJson =>
  buildRequest({ id: `demo-${kind}`, kind, branch: 'binding', chain: CHAIN, baseUrl: BASE_URL, now: NOW })

/** Signs the way the wallet does: EIP-191 for a nonce and SIWE text, EIP-712 with integers as bigint. */
const sign = async (request: SigningRequestJson): Promise<string> => {
  if (request.kind === 'personal_sign') return account.signMessage({ message: nonceFor(request.id) })
  if (request.kind === 'eip712') {
    const data = typedDataFor(request.id, request.chain)
    return account.signTypedData({
      domain: data.domain,
      types: data.types,
      primaryType: data.primaryType,
      message: { requestId: request.id, amount: BigInt(1) },
    })
  }
  const p = request.payload as {
    domain: string
    uri: string
    chainId: number
    nonce: string
    statement: string
    issuedAt: string
  }
  const message = createSiweMessage({
    address: account.address,
    chainId: p.chainId,
    domain: p.domain,
    nonce: p.nonce,
    uri: p.uri,
    version: '1',
    statement: p.statement,
    issuedAt: new Date(p.issuedAt),
  })
  return account.signMessage({ message })
}

describe('requester verification', () => {
  for (const kind of ['personal_sign', 'eip712', 'siwe'] as const) {
    it(`accepts a correct ${kind} signature`, async () => {
      const request = make(kind)
      const signature = await sign(request)

      const verdict = await verifyResponse(request, { id: request.id, address: account.address, signature }, NOW)

      assert.deepEqual(verdict, { valid: true })
    })

    it(`rejects a ${kind} signature claimed for another address`, async () => {
      const request = make(kind)
      const signature = await sign(request)
      const other = privateKeyToAccount(generatePrivateKey()).address

      const verdict = await verifyResponse(request, { id: request.id, address: other, signature }, NOW)

      assert.equal(verdict.valid, false)
    })
  }

  it('rejects a signature made for another request', async () => {
    const request = make('personal_sign')
    const signature = await sign(make('eip712'))

    const verdict = await verifyResponse(request, { id: request.id, address: account.address, signature }, NOW)

    assert.equal(verdict.valid, false)
  })

  it('rejects an answer with a different id', async () => {
    const request = make('personal_sign')
    const signature = await sign(request)

    const verdict = await verifyResponse(request, { id: 'other', address: account.address, signature }, NOW)

    assert.deepEqual(verdict, { valid: false, reason: 'id mismatch' })
  })

  it('names the SIWE domain after the host the wallet reached', () => {
    const request = make('siwe')

    assert.equal((request.payload as { domain: string }).domain, '10.0.2.2:8787')
    assert.equal(request.response_uri, `${BASE_URL}/requests/demo-siwe/response`)
  })
})
