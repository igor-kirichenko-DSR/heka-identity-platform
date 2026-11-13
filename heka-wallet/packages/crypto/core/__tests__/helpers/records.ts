import type { TxRecord } from '../../src'

import { BASE_SEPOLIA, usdcOn } from './chains'

export const HOLDER = '0x1111111111111111111111111111111111111111'
export const RECIPIENT = '0x2222222222222222222222222222222222222222'
export const T0 = Date.UTC(2026, 10, 9, 12, 0, 0)

export const makeRecord = (overrides: Partial<TxRecord> = {}): TxRecord => ({
  chainId: BASE_SEPOLIA,
  account: HOLDER,
  txId: '0xaaa0000000000000000000000000000000000000000000000000000000000001',
  explorerHash: '0xaaa0000000000000000000000000000000000000000000000000000000000001',
  direction: 'out',
  asset: usdcOn(BASE_SEPOLIA),
  amount: BigInt(1500000),
  counterparty: RECIPIENT,
  fee: { asset: usdcOn(BASE_SEPOLIA), amount: BigInt(12345) },
  status: 'pending',
  createdAt: T0,
  source: 'local',
  ...overrides,
})
