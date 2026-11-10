import type { AssetDescriptor, ChainId, TxDirection, TxRecord } from '@heka-wallet/crypto-core'
import type { Address, Hex } from 'viem'

import { sameAddress } from '@heka-wallet/crypto-core'
import { getAddress, parseAbiItem } from 'viem'

import { EvmAdapterError } from './errors'

export const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')

/** Which blocks are still to scan: [floorBlock, toBlock], walked backwards. */
export interface HistoryCursor {
  toBlock: bigint
  floorBlock: bigint
}

const CURSOR_PATTERN = /^(\d+):(\d+)$/
const ZERO = BigInt(0)
const ONE = BigInt(1)
const MS_PER_SECOND = BigInt(1000)

export const encodeCursor = ({ toBlock, floorBlock }: HistoryCursor): string => `${toBlock}:${floorBlock}`

export const decodeCursor = (cursor: string): HistoryCursor => {
  const match = CURSOR_PATTERN.exec(cursor)
  if (!match) throw new EvmAdapterError(`Malformed history cursor: "${cursor}"`)
  const toBlock = BigInt(match[1])
  const floorBlock = BigInt(match[2])
  if (floorBlock > toBlock) throw new EvmAdapterError(`Malformed history cursor: "${cursor}"`)
  return { toBlock, floorBlock }
}

/** The first page starts at the head and never looks further back than the window. */
export const firstCursor = (head: bigint, windowBlocks: bigint): HistoryCursor => {
  const floor = head - windowBlocks + ONE
  return { toBlock: head, floorBlock: floor > ZERO ? floor : ZERO }
}

/** One Transfer log, already narrowed to what history needs. */
export interface TransferLog {
  token: Address
  from: Address
  to: Address
  value: bigint
  blockNumber: bigint
  logIndex: number
  transactionHash: Hex
}

/** The logs of one page; 'next' is absent once the window floor is reached. */
export interface TransferScan {
  logs: TransferLog[]
  next?: HistoryCursor
}

export type FetchTransferLogs = (fromBlock: bigint, toBlock: bigint) => Promise<TransferLog[]>

/** Walks back chunk by chunk and stops at the first chunk with transfers or at the floor. */
export const scanTransfers = async (
  cursor: HistoryCursor,
  logsMaxRange: number,
  fetchLogs: FetchTransferLogs
): Promise<TransferScan> => {
  // A range below 1 would never move fromBlock down
  if (!Number.isInteger(logsMaxRange) || logsMaxRange < 1) {
    throw new EvmAdapterError(`logsMaxRange must be a positive integer, got ${logsMaxRange}`)
  }
  const { floorBlock } = cursor
  const range = BigInt(logsMaxRange)
  const chunkStart = (toBlock: bigint): bigint => {
    const lowest = toBlock - range + ONE
    return lowest > floorBlock ? lowest : floorBlock
  }

  let toBlock = cursor.toBlock
  let fromBlock = chunkStart(toBlock)
  let logs = await fetchLogs(fromBlock, toBlock)
  // Each step moves fromBlock down by at least one block, so the loop ends at the floor
  while (logs.length === 0 && fromBlock > floorBlock) {
    toBlock = fromBlock - ONE
    fromBlock = chunkStart(toBlock)
    logs = await fetchLogs(fromBlock, toBlock)
  }
  return fromBlock > floorBlock ? { logs, next: { toBlock: fromBlock - ONE, floorBlock } } : { logs }
}

/** Newest first; one record per log, a self-transfer counts once. */
export const sortAndDedupe = (logs: TransferLog[]): TransferLog[] => {
  const seen = new Set<string>()
  return logs
    .filter((log) => {
      const key = `${log.transactionHash.toLowerCase()}:${log.logIndex}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) =>
      a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1
    )
}

const directionOf = (log: TransferLog, holder: string): TxDirection => {
  const fromHolder = sameAddress(log.from, holder)
  const toHolder = sameAddress(log.to, holder)
  if (fromHolder && toHolder) return 'self'
  return fromHolder ? 'out' : 'in'
}

export const toTxRecord = (
  log: TransferLog,
  chainId: ChainId,
  holder: string,
  asset: AssetDescriptor,
  blockTimestampSeconds: bigint
): TxRecord => {
  const direction = directionOf(log, holder)
  return {
    chainId,
    account: getAddress(holder),
    txId: log.transactionHash,
    explorerHash: log.transactionHash,
    direction,
    asset,
    amount: log.value,
    counterparty: getAddress(direction === 'in' ? log.from : log.to),
    // A log exists only for a transaction that succeeded
    status: 'success',
    createdAt: Number(blockTimestampSeconds * MS_PER_SECOND),
    source: 'chain',
  }
}
