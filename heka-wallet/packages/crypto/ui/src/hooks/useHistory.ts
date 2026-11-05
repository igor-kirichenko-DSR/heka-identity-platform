import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useMemo } from 'react'

import { useCrypto } from '../provider/CryptoContext'

/** Own sends and chain history, newest first; the first page reloads whenever the screen comes into view. */
export const useHistory = () => {
  const { accounts, registry, transactions } = useCrypto()
  const account = accounts.currentAccount
  const chainId = account?.chainId
  const address = account?.address
  const chain = chainId ? registry.get(chainId).chain : undefined

  // Keyed by chain and address, so a new Account object for the same account does not reload the history.
  const current = useMemo(
    () => (chainId && address ? accounts.accountFor(chainId) : undefined),
    [accounts, chainId, address]
  )

  const load = useCallback(() => {
    if (current) void transactions.loadHistory(current)
  }, [current, transactions])

  const loadMore = useCallback(() => {
    if (current) void transactions.loadMoreHistory(current)
  }, [current, transactions])

  useFocusEffect(load)

  const state = account ? transactions.historyStateOf(account) : undefined

  return {
    records: account ? transactions.historyOf(account) : [],
    isLoading: !!state?.isLoading,
    hasMore: !!state?.hasMore,
    failed: !!state?.error,
    // Logs-based history covers a bounded block window and cannot see inbound native transfers.
    isPartial: chain?.features.historySource === 'rpc-logs',
    load,
    loadMore,
  }
}
