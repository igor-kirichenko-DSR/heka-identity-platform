import type { LedgerStorage, LedgerStorageEntry } from './LedgerStorage'

/** Non-persistent storage for tests. */
export class MemoryLedgerStorage implements LedgerStorage {
  private readonly entries = new Map<string, { value: string; tags: Record<string, string> }>()

  async put(key: string, value: string, tags: Record<string, string>): Promise<void> {
    this.entries.set(key, { value, tags: { ...tags } })
  }

  async get(key: string): Promise<string | undefined> {
    return this.entries.get(key)?.value
  }

  async list(): Promise<LedgerStorageEntry[]> {
    return [...this.entries].map(([key, { value }]) => ({ key, value }))
  }

  tagsOf(key: string): Record<string, string> | undefined {
    return this.entries.get(key)?.tags
  }
}
