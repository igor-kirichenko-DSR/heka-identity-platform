import type { CryptoServices } from './createCryptoServices'
import type { ChainId } from '@heka-wallet/crypto-core'

import { useEffect, useRef } from 'react'

/** Applies the saved default chain, or the app's default when none is saved or it is not registered. */
const applyDefaultChain = async (services: CryptoServices, defaultChainId: ChainId): Promise<void> => {
  const { accounts, chainPreference, registry, logger } = services
  let saved: ChainId | undefined
  try {
    saved = await chainPreference.get()
  } catch (error) {
    logger.warn('Failed to read the default chain', { error: String(error) })
  }
  const chainId = [saved, defaultChainId].find((id): id is ChainId => !!id && registry.has(id))
  if (chainId) accounts.setChain(chainId)
}

/**
 * Keys and polling follow the identity wallet: locked while it is locked (lockout clears nothing in memory but
 * stops every key use), unlocked and reloaded once it is open again.
 */
export const useLockSync = (services: CryptoServices, isUnlocked: boolean, defaultChainId: ChainId): void => {
  const started = useRef(false)
  const ledgerLoaded = useRef(false)

  useEffect(() => {
    const { keys, balances, wallet, transactions } = services
    if (!isUnlocked) {
      keys.lock()
      balances.setLocked(true)
      return
    }
    let cancelled = false
    keys.unlock()
    // Every await may span a lock: the effect cleanup sets `cancelled`, and nothing may resume after it.
    const open = async () => {
      await wallet.load()
      if (cancelled) return
      await applyDefaultChain(services, defaultChainId)
      if (cancelled) return
      balances.setLocked(false)
      if (!started.current) {
        started.current = true
        balances.start()
      }
      // The ledger holds the pending sends the one-pending-send rule needs: read it again until a read succeeds.
      if (ledgerLoaded.current) return
      const earlierError = transactions.ledgerError
      await transactions.init()
      // init() records a failed read as a new ledgerError; an unchanged one means this read succeeded.
      ledgerLoaded.current = transactions.ledgerError === earlierError
    }
    void open()
    return () => {
      cancelled = true
    }
  }, [services, isUnlocked, defaultChainId])
}
