import type { LedgerStorage, LedgerStorageEntry } from './LedgerStorage'

import { LedgerError } from '../errors'

/** Raw Askar entries, as Spike C chose for the seed: no Credo API lists this category. */
export const LEDGER_CATEGORY = 'crypto-ledger'

interface EntryRef {
  category: string
  name: string
}

interface EntryWrite extends EntryRef {
  value: string
  tags?: Record<string, unknown>
}

/** The part of an Askar `Session` the ledger uses; core does not import Askar or Credo. */
export interface AskarSessionLike {
  fetch(options: EntryRef): Promise<{ value: unknown } | null>
  fetchAll(options: { category: string }): Promise<Array<{ name: string; value: unknown }>>
  insert(options: EntryWrite): Promise<void>
  replace(options: EntryWrite): Promise<void>
}

/** The app passes `(cb) => agent.dependencyManager.resolve(AskarStoreManager).withSession(agent.context, cb)`. */
export type WithAskarSession = <T>(callback: (session: AskarSessionLike) => Promise<T>) => Promise<T>

const readValue = (name: string, value: unknown): string => {
  if (typeof value !== 'string') throw new LedgerError(`Ledger entry ${name} has a non-string value`)
  return value
}

export class AskarLedgerStorage implements LedgerStorage {
  constructor(private readonly withSession: WithAskarSession) {}

  put(key: string, value: string, tags: Record<string, string>): Promise<void> {
    return this.withSession(async (session) => {
      const entry = { category: LEDGER_CATEGORY, name: key, value, tags }
      const existing = await session.fetch({ category: LEDGER_CATEGORY, name: key })
      if (existing) await session.replace(entry)
      else await session.insert(entry)
    })
  }

  get(key: string): Promise<string | undefined> {
    return this.withSession(async (session) => {
      const entry = await session.fetch({ category: LEDGER_CATEGORY, name: key })
      return entry ? readValue(key, entry.value) : undefined
    })
  }

  list(): Promise<LedgerStorageEntry[]> {
    return this.withSession(async (session) => {
      const entries = await session.fetchAll({ category: LEDGER_CATEGORY })
      return entries.map(({ name, value }) => ({ key: name, value: readValue(name, value) }))
    })
  }
}
