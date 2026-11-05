import {
  deserializeLedgerEntry,
  LedgerError,
  LocalLedger,
  MemoryLedgerStorage,
  serializeLedgerEntry,
  txKey,
} from '../../src'
import { BASE_SEPOLIA, HEDERA_TESTNET_EVM } from '../helpers/chains'
import { makeLogger } from '../helpers/logger'
import { makeRecord } from '../helpers/records'

describe('LocalLedger', () => {
  it('reads a record back after a restart with bigint fields intact', async () => {
    const storage = new MemoryLedgerStorage()
    const record = makeRecord({ amount: BigInt('123456789012345678901234567890') })
    await new LocalLedger(storage, makeLogger()).put(record)

    const restarted = new LocalLedger(storage, makeLogger())

    expect(await restarted.get(BASE_SEPOLIA, record.txId)).toEqual(record)
    expect(await restarted.list()).toEqual([record])
  })

  it('replaces the entry for the same chain and tx id, and tags it with chain and status', async () => {
    const storage = new MemoryLedgerStorage()
    const ledger = new LocalLedger(storage, makeLogger())
    const record = makeRecord()

    await ledger.put(record)
    await ledger.put({ ...record, txId: record.txId.toUpperCase().replace('0X', '0x'), status: 'success' })

    expect(await ledger.list()).toEqual([{ ...record, txId: expect.any(String), status: 'success' }])
    expect(storage.tagsOf(txKey(BASE_SEPOLIA, record.txId))).toEqual({ chainId: BASE_SEPOLIA, status: 'success' })
  })

  it('keeps the same tx id on two chains apart', async () => {
    const ledger = new LocalLedger(new MemoryLedgerStorage(), makeLogger())
    await ledger.put(makeRecord())
    await ledger.put(makeRecord({ chainId: HEDERA_TESTNET_EVM }))

    expect(await ledger.list()).toHaveLength(2)
  })

  it('lists only pending entries for resumption', async () => {
    const ledger = new LocalLedger(new MemoryLedgerStorage(), makeLogger())
    const pending = makeRecord({ txId: '0x01' })
    await ledger.put(pending)
    await ledger.put(makeRecord({ txId: '0x02', status: 'success' }))
    await ledger.put(makeRecord({ txId: '0x03', status: 'unknown' }))

    expect(await ledger.listPending()).toEqual([pending])
  })

  it('logs and skips an unreadable entry', async () => {
    const storage = new MemoryLedgerStorage()
    const logger = makeLogger()
    const ledger = new LocalLedger(storage, logger)
    const good = makeRecord()
    await ledger.put(good)
    await storage.put('broken', '{"v":1,"record":{"chainId":"eip155:1"}}', {})

    expect(await ledger.list()).toEqual([good])
    expect(logger.error).toHaveBeenCalledWith(
      'Skipping an unreadable ledger entry',
      expect.objectContaining({ key: 'broken' })
    )
  })

  it.each([-1, 256, 1.5])('rejects an entry whose asset has %s decimals', (decimals) => {
    const record = makeRecord()
    const entry = serializeLedgerEntry({ ...record, asset: { ...record.asset, decimals } })

    expect(() => deserializeLedgerEntry(entry)).toThrow(LedgerError)
  })

  it('throws when a single requested entry is unreadable', async () => {
    const storage = new MemoryLedgerStorage()
    await storage.put(txKey(BASE_SEPOLIA, '0x01'), 'not json', {})

    await expect(new LocalLedger(storage, makeLogger()).get(BASE_SEPOLIA, '0x01')).rejects.toThrow(LedgerError)
  })
})
