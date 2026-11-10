import type { Account, AssetDescriptor, TransferRequest } from '@heka-wallet/crypto-core'
import type { Address, Transport } from 'viem'

import { baseSepolia, EvmAdapter, type EvmChainConfig } from '../../src'

import { makeAddressBook } from './keys'

export const BASE_SEPOLIA_CHAIN_ID = 84532
export const ETH: AssetDescriptor = baseSepolia.descriptor.nativeAsset
export const USDC: AssetDescriptor = baseSepolia.descriptor.assets[0]
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
/** A public address with no known key; only receives in tests. */
export const RECIPIENT: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

export const makeAdapter = (transport: Transport, config: EvmChainConfig = baseSepolia, cached?: string) =>
  new EvmAdapter({ config, addressBook: makeAddressBook(cached), transport })

export const accountOf = (address: string, index = 0): Account => ({
  chainId: baseSepolia.descriptor.id,
  address,
  index,
})

export const transferRequest = (from: Account, overrides: Partial<TransferRequest> = {}): TransferRequest => ({
  from,
  to: RECIPIENT,
  asset: USDC,
  amount: BigInt(10_000),
  feeMode: 'native',
  ...overrides,
})
