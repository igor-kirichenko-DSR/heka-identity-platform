import type { ChainId } from '@heka-wallet/crypto-core'

import { useCallback, useEffect, useState } from 'react'

import { useCrypto } from '../provider/CryptoContext'

/** Default chain (saved, and selected at once) and which wallet actions this seed allows. */
export const useSettings = () => {
  const { accounts, chainPreference, registry, wallet, logger } = useCrypto()
  const [defaultChainId, setDefaultChainId] = useState<ChainId>()
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    chainPreference
      .get()
      .then((saved) => !cancelled && setDefaultChainId(saved ?? accounts.currentChainId))
      .catch((error: unknown) => logger.warn('Failed to read the default chain', { error: String(error) }))
    return () => {
      cancelled = true
    }
  }, [chainPreference, accounts, logger])

  const setDefaultChain = useCallback(
    async (chainId: ChainId) => {
      setDefaultChainId(chainId)
      setSaveFailed(false)
      accounts.setChain(chainId)
      try {
        await chainPreference.set(chainId)
      } catch (error) {
        logger.error('Failed to save the default chain', { chainId, error: String(error) })
        setSaveFailed(true)
      }
    },
    [accounts, chainPreference, logger]
  )

  return {
    chains: registry.list().map((adapter) => adapter.chain),
    defaultChainId,
    setDefaultChain,
    saveFailed,
    // A raw-key wallet has no phrase to reveal.
    canReveal: wallet.status === 'mnemonic',
  }
}
