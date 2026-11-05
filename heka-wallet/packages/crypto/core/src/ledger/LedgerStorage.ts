export interface LedgerStorageEntry {
  key: string
  value: string
}

/** Key-value persistence behind LocalLedger; the app provides the Askar-backed one. */
export interface LedgerStorage {
  /** Insert or replace. */
  put(key: string, value: string, tags: Record<string, string>): Promise<void>
  get(key: string): Promise<string | undefined>
  list(): Promise<LedgerStorageEntry[]>
}
