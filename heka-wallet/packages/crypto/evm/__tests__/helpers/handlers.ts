import type { Hex } from 'viem'

import { keccak256 } from 'viem'

import { BASE_SEPOLIA_CHAIN_ID } from './chain'
import { hex, type RpcHandler } from './rpc'

export const BASE_FEE = BigInt(1_000_000)
export const PRIORITY_FEE = BigInt(1_000_000)
/** viem's estimateFeesPerGas: baseFee × 1.2 + priority fee. */
export const MAX_FEE = (BASE_FEE * BigInt(12)) / BigInt(10) + PRIORITY_FEE
export const PENDING_NONCE = 7

interface SendDefaults {
  gas?: bigint
  balance?: bigint
  chainId?: number
  sent?: Hex[]
}

/** A healthy Base Sepolia node for fee quotes and sends. */
export const sendHandlers = ({
  gas = BigInt(21_000),
  balance = BigInt(10) ** BigInt(18),
  chainId = BASE_SEPOLIA_CHAIN_ID,
  sent = [],
}: SendDefaults = {}): Record<string, RpcHandler> => ({
  eth_chainId: () => hex(chainId),
  eth_getBlockByNumber: () => ({
    number: '0x100',
    hash: `0x${'ab'.repeat(32)}`,
    timestamp: '0x6911a4c5',
    baseFeePerGas: hex(BASE_FEE),
    transactions: [],
  }),
  eth_maxPriorityFeePerGas: () => hex(PRIORITY_FEE),
  eth_estimateGas: () => hex(gas),
  eth_getBalance: () => hex(balance),
  eth_getTransactionCount: () => hex(PENDING_NONCE),
  eth_sendRawTransaction: (params) => {
    const serialized = params[0] as Hex
    sent.push(serialized)
    return keccak256(serialized)
  },
})
