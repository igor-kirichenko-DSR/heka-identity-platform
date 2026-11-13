import type { ChainPreference } from './ChainPreference'
import type { CryptoServicesConfig } from './createCryptoServices'
import type { ChainId } from '@heka-wallet/crypto-core'

import { useStore } from '@bifold/core'
import React, { type PropsWithChildren, useEffect, useState } from 'react'

import { AsyncStorageChainPreference } from './AsyncStorageChainPreference'
import { CryptoContext } from './CryptoContext'
import { createCryptoServices, disposeCryptoServices } from './createCryptoServices'
import { useForegroundRefresh } from './useForegroundRefresh'
import { useLockSync } from './useLockSync'

export interface CryptoProviderProps extends Omit<CryptoServicesConfig, 'chainPreference'> {
  defaultChainId: ChainId
  chainPreference?: ChainPreference
  /** False while the agent's store is not open (start-up, lockout shutdown); the seed store must not be read then. */
  isAgentReady?: boolean
}

/**
 * Builds the payment services once from the first props (registering adapters twice would fail) and ties them to
 * the identity wallet's lock state. Mounted by the app only when the crypto module is on.
 */
export const CryptoProvider: React.FC<PropsWithChildren<CryptoProviderProps>> = ({
  children,
  defaultChainId,
  chainPreference,
  isAgentReady = true,
  ...config
}) => {
  const [store] = useStore()
  const [services] = useState(() =>
    createCryptoServices({ ...config, chainPreference: chainPreference ?? new AsyncStorageChainPreference() })
  )
  const isUnlocked = store.authentication.didAuthenticate && isAgentReady

  useLockSync(services, isUnlocked, defaultChainId)
  useForegroundRefresh(services.balances)
  useEffect(() => () => disposeCryptoServices(services), [services])

  return <CryptoContext.Provider value={services}>{children}</CryptoContext.Provider>
}
