import type { Account } from '@heka-wallet/crypto-core'

import { useEffect } from 'react'

import { useCrypto } from '../provider/CryptoContext'

/**
 * The ledger account id (Hedera `0.0.x`) of the current account, when the adapter can tell. It is read once per
 * account and kept in the account store; an account not on the ledger yet has none.
 */
export const useAccountId = (account: Account | undefined): string | undefined => {
  const { accounts, registry, logger } = useCrypto()
  const chainId = account?.chainId
  const address = account?.address
  const index = account?.index
  const adapter = chainId ? registry.get(chainId) : undefined

  useEffect(() => {
    if (!adapter?.getAccountId || !chainId || !address || index === undefined) return
    let cancelled = false
    adapter
      .getAccountId({ chainId, address, index })
      .then((accountId) => {
        if (!cancelled) accounts.setAccountId(chainId, accountId)
      })
      .catch((error) => logger.warn('Failed to read the account id', { chainId, error: String(error) }))
    return () => {
      cancelled = true
    }
  }, [accounts, adapter, address, chainId, index, logger])

  return chainId ? accounts.accountIds.get(chainId) : undefined
}
