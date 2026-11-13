import type { AskarSeedSessionLike } from '../../src'

interface Row {
  category: string
  name: string
  value: unknown
  tags?: Record<string, unknown>
}

/** Mimics an Askar session over one in-memory table; insert fails on a duplicate, replace and remove on a gap. */
export class FakeSeedSession implements AskarSeedSessionLike {
  readonly rows = new Map<string, Row>()

  fetch = jest.fn(async ({ category, name }: { category: string; name: string }) => {
    const row = this.rows.get(`${category}/${name}`)
    return row ? { value: row.value, tags: row.tags ?? {} } : null
  })

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

  remove = jest.fn(async ({ category, name }: { category: string; name: string }) => {
    if (!this.rows.delete(`${category}/${name}`)) throw new Error('Entry not found')
  })
}
