import type { BalanceStore } from '@heka-wallet/crypto-core'

import { useEffect } from 'react'
import { AppState } from 'react-native'

/** Balances poll with backoff; coming back to the app resets it so the holder sees fresh numbers. */
export const useForegroundRefresh = (balances: BalanceStore): void => {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') balances.onForeground()
    })
    return () => subscription.remove()
  }, [balances])
}
