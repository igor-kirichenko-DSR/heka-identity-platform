import { TREE_MAX_DEPTH } from '../../src/constants'
import { typedDataRows } from '../../src/utils/typedDataRows'

describe('typedDataRows', () => {
  it('flattens nested fields into labelled rows with depth', () => {
    const rows = typedDataRows({ message: { nonce: 'n1', to: { wallet: '0xabc' } } })

    expect(rows.map(({ label, depth, text }) => ({ label, depth, text }))).toEqual([
      { label: 'message', depth: 1, text: undefined },
      { label: 'nonce', depth: 2, text: 'n1' },
      { label: 'to', depth: 2, text: undefined },
      { label: 'wallet', depth: 3, text: '0xabc' },
    ])
  })

  it('shows numbers, booleans and list items as plain text', () => {
    const rows = typedDataRows({ amount: 42, ok: true, items: ['a', 'b'] })

    expect(rows.filter((row) => row.text !== undefined).map((row) => row.text)).toEqual(['42', 'true', 'a', 'b'])
  })

  it('gives every row a unique key', () => {
    const rows = typedDataRows({ a: { x: '1' }, b: { x: '1' } })

    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
  })

  it('cuts a payload nested deeper than the limit', () => {
    let deep: unknown = 'leaf'
    for (let i = 0; i < TREE_MAX_DEPTH + 3; i++) deep = { next: deep }

    const rows = typedDataRows(deep)

    expect(Math.max(...rows.map((row) => row.depth))).toBeLessThanOrEqual(TREE_MAX_DEPTH)
    expect(rows[rows.length - 1].text).toBe('...')
  })
})
