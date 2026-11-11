import type { ChainPreference } from './ChainPreference'

import {
  type AddressBook,
  AccountStore,
  AdapterRegistry,
  AskarLedgerStorage,
  AskarSeedStore,
  type AuthProofIssuer,
  BalanceStore,
  type ChainAdapter,
  type CoreLogger,
  type KeyProvider,
  LocalLedger,
  SeedKeyProvider,
  TransactionStore,
  WalletStore,
  type WithAskarSeedSession,
  type WithAskarSession,
} from '@heka-wallet/crypto-core'

/** The passkey backup of the identity wallet; present only where the app has it on. */
export interface WalletBackup {
  backupNow(): Promise<void>
}

export interface CryptoServicesConfig {
  /** Called once with the key provider's address book; adapters need it to read cached addresses. */
  createAdapters: (addressBook: AddressBook) => ChainAdapter[]
  withSeedSession: WithAskarSeedSession
  withLedgerSession: WithAskarSession
  logger: CoreLogger
  chainPreference: ChainPreference
  backup?: WalletBackup
}

export interface CryptoServices {
  registry: AdapterRegistry
  keys: KeyProvider
  /** The only issuer; screens get proofs through useAuthProof. */
  authIssuer: AuthProofIssuer
  accounts: AccountStore
  balances: BalanceStore
  transactions: TransactionStore
  wallet: WalletStore
  chainPreference: ChainPreference
  backup?: WalletBackup
  logger: CoreLogger
}

export const createCryptoServices = (config: CryptoServicesConfig): CryptoServices => {
  const { createAdapters, withSeedSession, withLedgerSession, logger, chainPreference, backup } = config
  const registry = new AdapterRegistry()
  const keys = new SeedKeyProvider({ storage: new AskarSeedStore(withSeedSession) })
  createAdapters(keys).forEach((adapter) => registry.register(adapter))
  const authIssuer = keys.createAuthProofIssuer()
  const accounts = new AccountStore(registry, keys, logger)
  const balances = new BalanceStore(registry, accounts, logger)
  const ledger = new LocalLedger(new AskarLedgerStorage(withLedgerSession), logger)
  const transactions = new TransactionStore(registry, ledger, keys, logger)
  const wallet = new WalletStore(keys, accounts, logger)
  return { registry, keys, authIssuer, accounts, balances, transactions, wallet, chainPreference, backup, logger }
}

export const disposeCryptoServices = (services: CryptoServices): void => {
  services.balances.dispose()
  services.transactions.dispose()
  services.keys.lock()
}
