import type { CryptoProviderProps } from '@heka-wallet/crypto-ui'

import { baseSepolia, EvmAdapter, type EvmChainConfig, HederaEvmAdapter, hederaTestnet } from '@heka-wallet/crypto-evm'
import { GlobalLogger } from '@heka-wallet/shared'
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'

import { getCryptoConfig, isWalletBackupEnabled } from '../config'
import { useRootStore } from '../contexts'
import { type CryptoChainOverrides } from '../cryptoConfig'
import { useHekaAgent } from '../utils/agent'
import { createAgentTransactionRunner, AskarStoreClosedError } from '../utils/askarSession'
import { useWalletBackupHelpers } from '../utils/useWalletBackupHelpers'

const logger = GlobalLogger.createContextLogger('Crypto')

const withRpcOverride = (config: EvmChainConfig, overrides?: CryptoChainOverrides): EvmChainConfig =>
  overrides?.rpcUrl ? { ...config, descriptor: { ...config.descriptor, rpcUrl: overrides.rpcUrl } } : config

/**
 * Everything `CryptoProvider` needs from the app. The provider builds its services once from the first props, so
 * the agent and the backup are reached through refs that always hold the latest value.
 */
export const useCryptoHost = (): Omit<CryptoProviderProps, 'children'> => {
  const { agent } = useHekaAgent()
  const { passkeysStore } = useRootStore()
  const { backupWallet } = useWalletBackupHelpers()

  const agentRef = useRef(agent)
  const backupRef = useRef<(() => Promise<void>) | undefined>(undefined)
  // Layout effects run before every passive effect, including the provider's unlock effect that reads the store.
  useLayoutEffect(() => {
    agentRef.current = agent
  }, [agent])
  useLayoutEffect(() => {
    backupRef.current = async () => backupWallet(await passkeysStore.getUser())
  }, [backupWallet, passkeysStore])

  const config = useMemo(() => getCryptoConfig((message) => logger.warn(message)), [])

  const withSession = useCallback(
    async <T>(callback: Parameters<ReturnType<typeof createAgentTransactionRunner>>[0]) => {
      const current = agentRef.current
      if (!current) throw new AskarStoreClosedError()
      return (await createAgentTransactionRunner(current)(callback)) as T
    },
    []
  )

  const createAdapters = useCallback<CryptoProviderProps['createAdapters']>(
    (addressBook) => [
      new EvmAdapter({
        config: withRpcOverride(baseSepolia, config.overrides[baseSepolia.descriptor.id]),
        addressBook,
      }),
      new HederaEvmAdapter({
        config: withRpcOverride(hederaTestnet, config.overrides[hederaTestnet.descriptor.id]),
        addressBook,
      }),
    ],
    [config]
  )

  const backup = useMemo(
    () => (isWalletBackupEnabled ? { backupNow: async () => backupRef.current?.() } : undefined),
    []
  )

  return {
    createAdapters,
    withSeedSession: withSession,
    withLedgerSession: withSession,
    logger,
    defaultChainId: config.defaultChain,
    backup,
    isAgentReady: !!agent,
  }
}
