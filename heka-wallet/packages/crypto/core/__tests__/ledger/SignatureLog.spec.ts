import {
  AskarLedgerStorage,
  MemoryLedgerStorage,
  SIGNATURE_CATEGORY,
  SignatureLog,
  type SignatureRecord,
} from '../../src'
import { makeLogger } from '../helpers/logger'

const record = (id: string, signedAt: number, origin = 'https://rp.example.com'): SignatureRecord => ({
  id,
  origin,
  kind: 'siwe',
  chainId: 'eip155:84532',
  branch: 'binding',
  address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  signedAt,
})

describe('SignatureLog', () => {
  it('lists the records newest first', async () => {
    const log = new SignatureLog(new MemoryLedgerStorage(), makeLogger())
    await log.put(record('a', 1000))
    await log.put(record('b', 3000))
    await log.put(record('c', 2000))

    expect((await log.list()).map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('keeps the same request id from two origins apart and replaces a repeat', async () => {
    const log = new SignatureLog(new MemoryLedgerStorage(), makeLogger())
    await log.put(record('a', 1000))
    await log.put(record('a', 2000, 'https://other.example.com'))
    await log.put(record('a', 3000))

    const all = await log.list()
    expect(all).toHaveLength(2)
    expect(all[0].signedAt).toBe(3000)
  })

  it('stores neither payload nor signature', async () => {
    const storage = new MemoryLedgerStorage()
    await new SignatureLog(storage, makeLogger()).put(record('a', 1000))

    const [entry] = await storage.list()
    expect(Object.keys(JSON.parse(entry.value)).sort()).toEqual(
      ['address', 'branch', 'chainId', 'id', 'kind', 'origin', 'signedAt'].sort()
    )
  })

  it('logs and skips an unreadable entry', async () => {
    const storage = new MemoryLedgerStorage()
    const logger = makeLogger()
    await storage.put('bad', '{"id":1}', {})
    const log = new SignatureLog(storage, logger)
    await log.put(record('a', 1000))

    expect(await log.list()).toHaveLength(1)
    expect(logger.error).toHaveBeenCalledTimes(1)
  })

  it('uses a category of its own, apart from the send ledger', async () => {
    const rows: Array<{ category: string; name: string; value: string }> = []
    const session = {
      fetch: async () => null,
      fetchAll: async () => [],
      insert: async (entry: { category: string; name: string; value: string }) => void rows.push(entry),
      replace: async () => undefined,
    }
    const storage = new AskarLedgerStorage((callback) => callback(session), SIGNATURE_CATEGORY)

    await new SignatureLog(storage, makeLogger()).put(record('a', 1000))

    expect(rows.map((row) => row.category)).toEqual(['crypto-signatures'])
  })
})
