import type { ChainPreference } from '../../src/provider/ChainPreference'
import type { CryptoServices } from '../../src/provider/createCryptoServices'
import type { ChainDescriptor, ChainId } from '@heka-wallet/crypto-core'

import {
  AccountStore,
  AdapterRegistry,
  BalanceStore,
  LocalLedger,
  MemoryLedgerStorage,
  MemorySeedStorage,
  SeedKeyProvider,
  TransactionStore,
  WalletStore,
} from '@heka-wallet/crypto-core'
import { render } from '@testing-library/react-native'
import React, { type ReactElement } from 'react'

import { RegisterFlowProvider } from '../../src/navigators/RegisterFlowContext'
import { CryptoContext } from '../../src/provider/CryptoContext'
import { BASE_SEPOLIA, makeChain } from '../../../core/__tests__/helpers/chains'
import { FakeAdapter } from '../../../core/__tests__/helpers/FakeAdapter'
import { makeLogger } from '../../../core/__tests__/helpers/logger'

export { BASE_SEPOLIA, makeChain, usdcOn } from '../../../core/__tests__/helpers/chains'
export { FakeAdapter } from '../../../core/__tests__/helpers/FakeAdapter'
export { OTHER_MNEMONIC, OTHER_PAYMENT_0, OTHER_RAW_KEY } from '../../../core/__tests__/helpers/seeds'

export class MemoryChainPreference implements ChainPreference {
  constructor(public value: ChainId | undefined = undefined) {}
  get = jest.fn(async () => this.value)
  set = jest.fn(async (chainId: ChainId) => {
    this.value = chainId
  })
}

export interface TestServices extends CryptoServices {
  adapters: FakeAdapter[]
  seedStorage: MemorySeedStorage
}

/** Real core stores over memory storage and fake adapters: the screens run the real logic. */
export const makeServices = (
  chains: ChainDescriptor[] = [makeChain(BASE_SEPOLIA)],
  options: { backup?: CryptoServices['backup']; statusPollIntervalMs?: number } = {}
): TestServices => {
  const logger = makeLogger()
  const registry = new AdapterRegistry()
  const adapters = chains.map((chain) => new FakeAdapter(chain))
  adapters.forEach((adapter) => registry.register(adapter))
  const seedStorage = new MemorySeedStorage()
  const keys = new SeedKeyProvider({ storage: seedStorage })
  keys.unlock()
  const authIssuer = keys.createAuthProofIssuer()
  const accounts = new AccountStore(registry, keys, logger)
  const balances = new BalanceStore(registry, accounts, logger)
  const ledger = new LocalLedger(new MemoryLedgerStorage(), logger)
  const transactions = new TransactionStore(registry, ledger, keys, logger, {
    statusPollIntervalMs: options.statusPollIntervalMs,
  })
  const wallet = new WalletStore(keys, accounts, logger)
  return {
    registry,
    keys,
    authIssuer,
    accounts,
    balances,
    transactions,
    wallet,
    chainPreference: new MemoryChainPreference(),
    backup: options.backup,
    logger,
    adapters,
    seedStorage,
  }
}

export const renderWithServices = (ui: ReactElement, services: CryptoServices) =>
  render(
    <CryptoContext.Provider value={services}>
      <RegisterFlowProvider>{ui}</RegisterFlowProvider>
    </CryptoContext.Provider>
  )
