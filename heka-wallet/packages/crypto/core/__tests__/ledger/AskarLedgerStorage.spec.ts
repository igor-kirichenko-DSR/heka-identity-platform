import { AskarLedgerStorage, type AskarSessionLike, LEDGER_CATEGORY, LedgerError } from '../../src'

/** Mimics an Askar session over one in-memory table; insert fails on a duplicate like Askar does. */
class FakeSession implements AskarSessionLike {
  readonly rows = new Map<string, { category: string; name: string; value: unknown; tags?: Record<string, unknown> }>()

  fetch = jest.fn(async ({ category, name }: { category: string; name: string }) => {
    const row = this.rows.get(`${category}/${name}`)
    return row ? { value: row.value } : null
  })

  fetchAll = jest.fn(async ({ category }: { category: string }) =>
    [...this.rows.values()].filter((row) => row.category === category)
  )

  insert = jest.fn(async (entry: { category: string; name: string; value: string; tags?: Record<string, unknown> }) => {
    const id = `${entry.category}/${entry.name}`
    if (this.rows.has(id)) throw new Error('Duplicate entry')
    this.rows.set(id, entry)
  })

  replace = jest.fn(
    async (entry: { category: string; name: string; value: string; tags?: Record<string, unknown> }) => {
      const id = `${entry.category}/${entry.name}`
      if (!this.rows.has(id)) throw new Error('Entry not found')
      this.rows.set(id, entry)
    }
  )
}

const makeStorage = () => {
  const session = new FakeSession()
  const storage = new AskarLedgerStorage((callback) => callback(session))
  return { session, storage }
}

describe('AskarLedgerStorage', () => {
  it('inserts a new entry in the crypto-ledger category with its tags', async () => {
    const { session, storage } = makeStorage()

    await storage.put('k1', 'v1', { status: 'pending' })

    expect(session.insert).toHaveBeenCalledWith({
      category: LEDGER_CATEGORY,
      name: 'k1',
      value: 'v1',
      tags: { status: 'pending' },
    })
    expect(session.replace).not.toHaveBeenCalled()
    expect(await storage.get('k1')).toBe('v1')
  })

  it('replaces an existing entry', async () => {
    const { session, storage } = makeStorage()
    await storage.put('k1', 'v1', {})

    await storage.put('k1', 'v2', {})

    expect(session.replace).toHaveBeenCalledTimes(1)
    expect(await storage.get('k1')).toBe('v2')
  })

  it('lists only its own category', async () => {
    const { session, storage } = makeStorage()
    session.rows.set('crypto/seed', { category: 'crypto', name: 'seed', value: 'secret' })
    await storage.put('k1', 'v1', {})

    expect(await storage.list()).toEqual([{ key: 'k1', value: 'v1' }])
  })

  it('returns undefined for a missing entry', async () => {
    expect(await makeStorage().storage.get('missing')).toBeUndefined()
  })

  it('rejects a non-string value', async () => {
    const { session, storage } = makeStorage()
    session.rows.set(`${LEDGER_CATEGORY}/k1`, { category: LEDGER_CATEGORY, name: 'k1', value: { json: true } })

    await expect(storage.get('k1')).rejects.toThrow(LedgerError)
  })
})
