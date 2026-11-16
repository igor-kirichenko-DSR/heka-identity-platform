import type { SignatureRecord } from '@heka-wallet/crypto-core'

import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useState } from 'react'

import { useCrypto } from '../provider/CryptoContext'

/** What the holder signed for relying parties, newest first; reloads whenever the screen comes into view. */
export const useSignatures = () => {
  const { signatures, logger } = useCrypto()
  const [records, setRecords] = useState<SignatureRecord[]>([])
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    signatures
      .list()
      .then((list) => {
        if (cancelled) return
        setRecords(list)
        setFailed(false)
      })
      .catch((error: unknown) => {
        logger.error('Failed to load the signatures', { error: error instanceof Error ? error.name : 'unknown' })
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [signatures, logger])

  useFocusEffect(load)

  return { records, failed }
}
