import type { AssetDescriptor, AssetKind, TxDirection, TxRecord, TxSource, TxStatus } from '../types'

import { LedgerError } from '../errors'
import { isChainId } from '../utils/caip'
import { MAX_DECIMALS } from '../utils/units'

export const LEDGER_FORMAT_VERSION = 1

/** TxRecord with bigints as decimal strings, safe for JSON. */
export type SerializedTxRecord = Omit<TxRecord, 'amount' | 'fee'> & {
  amount: string
  fee?: { asset: AssetDescriptor; amount: string }
}

const STATUSES: readonly TxStatus[] = ['pending', 'success', 'failed', 'unknown']
const DIRECTIONS: readonly TxDirection[] = ['in', 'out', 'self']
const SOURCES: readonly TxSource[] = ['local', 'chain']
const ASSET_KINDS: readonly AssetKind[] = ['native', 'erc20', 'hts']
const INTEGER_STRING = /^-?\d+$/

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null

const fail = (field: string): never => {
  throw new LedgerError(`Invalid ledger record: ${field}`)
}

const readString = (source: Json, field: string): string => {
  const value = source[field]
  return typeof value === 'string' ? value : fail(field)
}

const readBigInt = (source: Json, field: string): bigint => {
  const value = readString(source, field)
  return INTEGER_STRING.test(value) ? BigInt(value) : fail(field)
}

const readOneOf = <T extends string>(source: Json, field: string, allowed: readonly T[]): T => {
  const value = readString(source, field)
  return (allowed as readonly string[]).includes(value) ? (value as T) : fail(field)
}

const readAsset = (value: unknown, field: string): AssetDescriptor => {
  if (!isObject(value)) return fail(field)
  const decimals = value.decimals
  if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) {
    return fail(`${field}.decimals`)
  }
  const asset: AssetDescriptor = {
    id: readString(value, 'id'),
    symbol: readString(value, 'symbol'),
    name: readString(value, 'name'),
    decimals,
    kind: readOneOf(value, 'kind', ASSET_KINDS),
  }
  if (typeof value.address === 'string') asset.address = value.address
  if (value.stable === 'USD' || value.stable === 'EUR') asset.stable = value.stable
  return asset
}

export const toSerializedTxRecord = ({ amount, fee, ...rest }: TxRecord): SerializedTxRecord => ({
  ...rest,
  amount: amount.toString(),
  ...(fee ? { fee: { asset: fee.asset, amount: fee.amount.toString() } } : {}),
})

/** Validates the shape; throws LedgerError on anything unexpected. */
export const fromSerializedTxRecord = (value: unknown): TxRecord => {
  if (!isObject(value)) return fail('record')
  const chainId = readString(value, 'chainId')
  if (!isChainId(chainId)) return fail('chainId')
  const createdAt = value.createdAt
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return fail('createdAt')

  const record: TxRecord = {
    chainId,
    account: readString(value, 'account'),
    txId: readString(value, 'txId'),
    explorerHash: readString(value, 'explorerHash'),
    direction: readOneOf(value, 'direction', DIRECTIONS),
    asset: readAsset(value.asset, 'asset'),
    amount: readBigInt(value, 'amount'),
    counterparty: readString(value, 'counterparty'),
    status: readOneOf(value, 'status', STATUSES),
    createdAt,
    source: readOneOf(value, 'source', SOURCES),
  }
  if (value.fee !== undefined) {
    if (!isObject(value.fee)) return fail('fee')
    record.fee = { asset: readAsset(value.fee.asset, 'fee.asset'), amount: readBigInt(value.fee, 'amount') }
  }
  return record
}

export const serializeLedgerEntry = (record: TxRecord): string =>
  JSON.stringify({ v: LEDGER_FORMAT_VERSION, record: toSerializedTxRecord(record) })

export const deserializeLedgerEntry = (json: string): TxRecord => {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (error) {
    throw new LedgerError(`Ledger entry is not JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!isObject(parsed) || parsed.v !== LEDGER_FORMAT_VERSION) return fail('version')
  return fromSerializedTxRecord(parsed.record)
}
