import { EvmAdapterError } from '../../src'
import { MirrorNodeClient } from '../../src/hedera/MirrorNodeClient'

import account from '../fixtures/hedera/account-active.json'
import contractResult from '../fixtures/hedera/contract-result-success.json'
import transactions from '../fixtures/hedera/transactions-page-1.json'

const BASE = 'https://mirror.test'

const reply = (status: number, body?: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }) as Response

const makeClient = (responses: (Response | Error)[]) => {
  const fetchFn = jest.fn(async (_url: string) => {
    const next = responses.shift()
    if (next === undefined) throw new Error('unexpected request')
    if (next instanceof Error) throw next
    return next
  })
  const sleeps: number[] = []
  const client = new MirrorNodeClient({
    baseUrl: BASE,
    fetchFn: fetchFn as unknown as typeof fetch,
    sleep: async (ms) => {
      sleeps.push(ms)
    },
  })
  return { client, fetchFn, sleeps }
}

describe('MirrorNodeClient', () => {
  it('reads an account with exact balances', async () => {
    const { client, fetchFn } = makeClient([reply(200, account)])

    const result = await client.getAccount('0x47341f3d96411012cCEBfad66DEb24e7718be038')

    expect(result).toMatchObject({ account: '0.0.11338782', hasKey: true, maxAutomaticTokenAssociations: -1 })
    expect(result?.balance).toBe(BigInt(980375900))
    expect(result?.tokens).toEqual([{ tokenId: '0.0.11339492', balance: BigInt(999980000) }])
    expect(fetchFn.mock.calls[0][0]).toContain('/api/v1/accounts/0x47341f3d96411012cCEBfad66DEb24e7718be038')
  })

  it('keeps a balance above 2^53 exact and reports a hollow account', async () => {
    const { client } = makeClient([
      reply(
        200,
        '{"account":"0.0.1","evm_address":"0x1","key":null,"balance":{"balance":5000000000000000001,"tokens":[]}}'
      ),
    ])

    const result = await client.getAccount('0.0.1')

    expect(result?.balance).toBe(BigInt('5000000000000000001'))
    expect(result?.hasKey).toBe(false)
  })

  it('returns null for an unknown account and an unknown contract result', async () => {
    const { client } = makeClient([reply(404, {}), reply(404, {})])

    await expect(client.getAccount('0x1111111111111111111111111111111111111111')).resolves.toBeNull()
    await expect(client.getContractResult('0xabc')).resolves.toBeNull()
  })

  it('reads a contract result by transaction id', async () => {
    const { client } = makeClient([reply(200, contractResult)])

    await expect(client.getContractResult('0.0.7314364-1793970433-499143344')).resolves.toEqual({
      hash: contractResult.hash,
      result: 'SUCCESS',
      to: contractResult.to,
    })
  })

  it('maps a transactions page and hands out the next link', async () => {
    const { client } = makeClient([reply(200, transactions)])

    const page = await client.getTransactions('0.0.11338782')

    expect(page.items).toHaveLength(10)
    expect(page.items[1]).toMatchObject({ name: 'ETHEREUMTRANSACTION', nonce: 0, chargedFee: BigInt(4534764) })
    expect(page.next).toBe(transactions.links.next)
  })

  it('follows a next link on the same origin only', async () => {
    const { client, fetchFn } = makeClient([reply(200, { transactions: [], links: { next: null } })])

    await client.getTransactions('0.0.1', '/api/v1/transactions?account.id=0.0.1&timestamp=lt:1')
    expect(fetchFn.mock.calls[0][0]).toBe(`${BASE}/api/v1/transactions?account.id=0.0.1&timestamp=lt:1`)

    await expect(client.getTransactions('0.0.1', 'https://evil.test/api/v1/transactions')).rejects.toThrow(
      EvmAdapterError
    )
  })

  it('retries a 503 with backoff and then succeeds', async () => {
    const { client, sleeps } = makeClient([reply(503), reply(200, account)])

    await expect(client.getAccount('0.0.11338782')).resolves.not.toBeNull()
    expect(sleeps).toEqual([500])
  })

  it('retries a network error and gives up after the retries', async () => {
    const { client, fetchFn, sleeps } = makeClient([new Error('offline'), new Error('offline'), new Error('offline')])

    await expect(client.getAccount('0.0.1')).rejects.toThrow('offline')
    expect(fetchFn).toHaveBeenCalledTimes(3)
    expect(sleeps).toEqual([500, 1000])
  })

  it('does not retry a 400', async () => {
    const { client, fetchFn } = makeClient([reply(400, {})])

    await expect(client.getAccount('bad')).rejects.toThrow(EvmAdapterError)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('refuses a plain-http base URL', () => {
    expect(() => new MirrorNodeClient({ baseUrl: 'http://mirror.test' })).toThrow(EvmAdapterError)
  })
})
