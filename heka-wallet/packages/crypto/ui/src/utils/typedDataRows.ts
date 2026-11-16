import { TREE_MAX_DEPTH } from '../constants'

export interface TreeRow {
  /** Unique within one tree. */
  key: string
  depth: number
  label: string
  /** Absent for a group (an object or a list). */
  text?: string
}

const CUT = '...'

const isGroup = (value: unknown): value is object => typeof value === 'object' && value !== null

/** Typed data as flat rows with a depth, shown as plain text only; depth beyond TREE_MAX_DEPTH is cut. */
export const typedDataRows = (value: unknown, label = '', depth = 0, path = ''): TreeRow[] => {
  const key = `${path}/${label}`
  if (!isGroup(value)) return [{ key, depth, label, text: String(value) }]
  if (depth >= TREE_MAX_DEPTH) return [{ key, depth, label, text: CUT }]
  const children = Object.entries(value).flatMap(([name, child]) => typedDataRows(child, name, depth + 1, key))
  return label === '' ? children : [{ key, depth, label }, ...children]
}
