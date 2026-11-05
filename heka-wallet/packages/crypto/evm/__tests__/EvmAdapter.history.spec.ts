import type { Hex } from 'viem'

import { getAddress, pad, toEventSelector } from 'viem'

import { baseSepolia, EvmAdapterError } from '../src'
import { decodeCursor, encodeCursor, firstCursor, scanTransfers, TRANSFER_EVENT } from '../src/history'

import { accountOf, makeAdapter, RECIPIENT, USDC, USDC_ADDRESS } from './helpers/chain'
import { createRpcMock, hex } from './helpers/rpc'

const HOLDER = getAddress('0x9c2b1f0a0a7e5d3c1b2a39485766a5b4c3d2e1f0')
const OTHER = RECIPIENT
const HEAD = 100_000
const FLOOR = HEAD - 10_000 + 1
const TIMESTAMP_BASE = 1_762_000_000
const TRANSFER_TOPIC = toEventSelector(TRANSFER_EVENT)

interface ChainLog {
  from: string
  to: string
  value: number
  block: number
  logIndex: number
  txHash: Hex
}

const txHash = (n: number): Hex => pad(hex(n) as Hex, { size: 32 })

const toRpcLog = (log: ChainLog) => ({
  address: USDC_ADDRESS.toLowerCase(),
  topics: [TRANSFER_TOPIC, pad(log.from.toLowerCase() as Hex), pad(log.to.toLowerCase() as Hex)],
  data: pad(hex(log.value) as Hex),
  blockNumber: hex(log.block),
  blockHash: pad(hex(log.block) as Hex, { size: 32 }),
  logIndex: hex(log.logIndex),
  transactionHash: log.txHash,
  transactionIndex: '0x0',
  removed: false,
})

interface LogFilter {
  fromBlock: string
  toBlock: string
  address: string[]
  topics: (string | null)[]
}

/** A node holding these logs; answers eth_getLogs by range and topics like a real node. */
const chainWith = (logs: ChainLog[]) => {
  const ranges: [number, number][] = []
  const rpc = createRpcMock({
    eth_blockNumber: () => hex(HEAD),
    eth_getBlockByNumber: (params) => ({ number: params[0], timestamp: hex(TIMESTAMP_BASE + Number(params[0])) }),
    eth_getLogs: (params) => {
      const filter = params[0] as LogFilter
      const from = Number(filter.fromBlock)
      const to = Number(filter.toBlock)
      ranges.push([from, to])
      expect(filter.address.map((address) => address.toLowerCase())).toEqual([USDC_ADDRESS.toLowerCase()])
      expect(filter.topics[0]).toBe(TRANSFER_TOPIC)
      const [, fromTopic, toTopic] = filter.topics
      return logs
        .filter((log) => log.block >= from && log.block <= to)
        .map(toRpcLog)
        .filter((log) => (!fromTopic || log.topics[1] === fromTopic) && (!toTopic || log.topics[2] === toTopic))
    },
  })
  return { rpc, ranges, adapter: makeAdapter(rpc.transport) }
}

const account = accountOf(HOLDER)

describe('EvmAdapter.getHistory', () => {
  it('first page: walks back from the head in 200-block chunks and stops at the first chunk with transfers', async () => {
    const { adapter, ranges } = chainWith([
      { from: OTHER, to: HOLDER, value: 20_000_000, block: 99_700, logIndex: 1, txHash: txHash(1) },
      { from: HOLDER, to: OTHER, value: 10_000, block: 99_750, logIndex: 4, txHash: txHash(2) },
      // Older, in a later chunk: not on this page
      { from: OTHER, to: HOLDER, value: 5, block: 95_000, logIndex: 0, txHash: txHash(3) },
    ])

    const page = await adapter.getHistory(account)

    expect([...new Set(ranges.map(([from, to]) => `${from}-${to}`))]).toEqual(['99801-100000', '99601-99800'])
    expect(page.next).toBe('99600:90001')
    expect(page.items).toEqual([
      {
        chainId: 'eip155:84532',
        account: HOLDER,
        txId: txHash(2),
        explorerHash: txHash(2),
        direction: 'out',
        asset: USDC,
        amount: BigInt(10_000),
        counterparty: OTHER,
        status: 'success',
        createdAt: (TIMESTAMP_BASE + 99_750) * 1000,
        source: 'chain',
      },
      {
        chainId: 'eip155:84532',
        account: HOLDER,
        txId: txHash(1),
        explorerHash: txHash(1),
        direction: 'in',
        asset: USDC,
        amount: BigInt(20_000_000),
        counterparty: OTHER,
        status: 'success',
        createdAt: (TIMESTAMP_BASE + 99_700) * 1000,
        source: 'chain',
      },
    ])
  })

  it('asks for sent and received transfers separately and counts a self-transfer once', async () => {
    const { adapter, rpc } = chainWith([
      { from: HOLDER, to: HOLDER, value: 10_000, block: 99_990, logIndex: 2, txHash: txHash(9) },
    ])

    const page = await adapter.getHistory(account)

    const topics = rpc.callsOf('eth_getLogs').map((call) => (call.params[0] as LogFilter).topics)
    expect(topics).toEqual(
      expect.arrayContaining([
        [TRANSFER_TOPIC, pad(HOLDER.toLowerCase() as Hex), null],
        [TRANSFER_TOPIC, null, pad(HOLDER.toLowerCase() as Hex)],
      ])
    )
    expect(page.items).toHaveLength(1)
    expect(page.items[0]).toMatchObject({ direction: 'self', counterparty: HOLDER })
  })

  it('next page continues from the cursor, keeps the floor and ends there without a next cursor', async () => {
    const { adapter, ranges } = chainWith([])

    const page = await adapter.getHistory(account, '99600:90001')

    expect(page).toEqual({ items: [] })
    const unique = [...new Set(ranges.map(([from, to]) => `${from}-${to}`))]
    expect(unique[0]).toBe('99401-99600')
    expect(unique[unique.length - 1]).toBe('90001-90200')
    ranges.forEach(([from, to]) => {
      expect(from).toBeGreaterThanOrEqual(FLOOR)
      expect(to - from + 1).toBeLessThanOrEqual(baseSepolia.logsMaxRange)
    })
  })

  it('a last chunk shorter than the range stops exactly at the floor', async () => {
    const { adapter, ranges } = chainWith([])
    await expect(adapter.getHistory(account, '90050:90001')).resolves.toEqual({ items: [] })
    expect([...new Set(ranges.map(([from, to]) => `${from}-${to}`))]).toEqual(['90001-90050'])
  })

  it('the window never goes below block 0 on a young chain', () => {
    expect(firstCursor(BigInt(150), BigInt(10_000))).toEqual({ toBlock: BigInt(150), floorBlock: BigInt(0) })
  })

  it.each(['', 'abc', '10', '10:20', '-1:0', '1.5:0'])('refuses a malformed cursor %p', async (cursor) => {
    const { adapter, rpc } = chainWith([])
    await expect(adapter.getHistory(account, cursor)).rejects.toThrow(EvmAdapterError)
    expect(rpc.callsOf('eth_getLogs')).toEqual([])
  })

  it.each([0, -1, 1.5])('refuses logsMaxRange %p instead of looping forever', async (logsMaxRange) => {
    const fetchLogs = jest.fn(async () => [])
    const cursor = { toBlock: BigInt(100), floorBlock: BigInt(1) }
    await expect(scanTransfers(cursor, logsMaxRange, fetchLogs)).rejects.toThrow(EvmAdapterError)
    expect(fetchLogs).not.toHaveBeenCalled()
  })

  it('a range of 1 walks block by block and stops at the floor', async () => {
    const fetchLogs = jest.fn(async () => [])
    await expect(scanTransfers({ toBlock: BigInt(5), floorBlock: BigInt(3) }, 1, fetchLogs)).resolves.toEqual({
      logs: [],
    })
    expect(fetchLogs.mock.calls).toEqual([
      [BigInt(5), BigInt(5)],
      [BigInt(4), BigInt(4)],
      [BigInt(3), BigInt(3)],
    ])
  })

  it('cursor round-trips', () => {
    const cursor = { toBlock: BigInt(99_600), floorBlock: BigInt(90_001) }
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor)
  })

  it('returns nothing on a chain without ERC-20 assets (no native inbound history)', async () => {
    const rpc = createRpcMock({})
    const config = { ...baseSepolia, descriptor: { ...baseSepolia.descriptor, assets: [] } }
    await expect(makeAdapter(rpc.transport, config).getHistory(account)).resolves.toEqual({ items: [] })
    expect(rpc.calls).toEqual([])
  })
})
