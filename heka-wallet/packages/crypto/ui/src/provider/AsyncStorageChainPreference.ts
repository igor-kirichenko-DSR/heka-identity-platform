import type { ChainPreference } from './ChainPreference'
import type { ChainId } from '@heka-wallet/crypto-core'

import AsyncStorage from '@react-native-async-storage/async-storage'

import { DEFAULT_CHAIN_STORAGE_KEY } from '../constants'

const CHAIN_ID_PATTERN = /^(eip155:\d+|hedera:(mainnet|testnet))$/

/** A chain id is not a secret, so plain AsyncStorage is enough and works before the wallet is unlocked. */
export class AsyncStorageChainPreference implements ChainPreference {
  async get(): Promise<ChainId | undefined> {
    const value = await AsyncStorage.getItem(DEFAULT_CHAIN_STORAGE_KEY)
    return value && CHAIN_ID_PATTERN.test(value) ? (value as ChainId) : undefined
  }

  async set(chainId: ChainId): Promise<void> {
    await AsyncStorage.setItem(DEFAULT_CHAIN_STORAGE_KEY, chainId)
  }
}
