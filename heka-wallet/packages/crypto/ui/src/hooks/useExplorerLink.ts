import type { TxRecord } from '@heka-wallet/crypto-core'

import { useCallback } from 'react'
import { Linking } from 'react-native'

import { useCrypto } from '../provider/CryptoContext'

/** Opens a transaction in the chain's explorer; the hash, not a user operation id, is what the explorer knows. */
export const useExplorerLink = () => {
  const { registry, logger } = useCrypto()

  return useCallback(
    (record: TxRecord) => {
      if (!registry.has(record.chainId)) return
      const url = registry.get(record.chainId).chain.explorer.tx(record.explorerHash)
      Linking.openURL(url).catch((error: unknown) =>
        logger.warn('Failed to open the explorer', { chainId: record.chainId, error: String(error) })
      )
    },
    [registry, logger]
  )
}
