import type { CoreLogger } from '../logger'
import type { LedgerStorage } from './LedgerStorage'

import { type ChainId, type TxRecord, txKey } from '../types'

import { deserializeLedgerEntry, serializeLedgerEntry } from './serialization'

/** The wallet's own sends (pending and final), persisted so they survive a restart. */
export class LocalLedger {
  constructor(
    private readonly storage: LedgerStorage,
    private readonly logger: CoreLogger
  ) {}

  /** Insert or replace by chain id + tx id. */
  async put(record: TxRecord): Promise<void> {
    await this.storage.put(txKey(record.chainId, record.txId), serializeLedgerEntry(record), {
      chainId: record.chainId,
      status: record.status,
    })
  }

  async get(chainId: ChainId, txId: string): Promise<TxRecord | undefined> {
    const value = await this.storage.get(txKey(chainId, txId))
    return value === undefined ? undefined : deserializeLedgerEntry(value)
  }

  /** An unreadable entry is logged and left out, so one bad record cannot hide the rest. */
  async list(): Promise<TxRecord[]> {
    const entries = await this.storage.list()
    const records: TxRecord[] = []
    for (const { key, value } of entries) {
      try {
        records.push(deserializeLedgerEntry(value))
      } catch (error) {
        this.logger.error('Skipping an unreadable ledger entry', { key, error: String(error) })
      }
    }
    return records
  }

  async listPending(): Promise<TxRecord[]> {
    return (await this.list()).filter((record) => record.status === 'pending')
  }
}
