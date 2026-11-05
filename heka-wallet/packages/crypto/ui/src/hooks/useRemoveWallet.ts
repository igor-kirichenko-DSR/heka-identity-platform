import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCrypto } from '../provider/CryptoContext'

import { useAuthProof } from './useAuthProof'

/** Removes the seed and its addresses only; after it the stack goes back to registration by itself. */
export const useRemoveWallet = () => {
  const { wallet, logger } = useCrypto()
  const { t } = useTranslation()
  const { request, gateProps } = useAuthProof(t('Crypto.Remove.Confirm'))
  const [isRemoving, setRemoving] = useState(false)
  const [failed, setFailed] = useState(false)

  const remove = useCallback(async () => {
    setFailed(false)
    const proof = await request()
    if (!proof) return
    setRemoving(true)
    try {
      await wallet.remove(proof)
    } catch (error) {
      logger.error('Failed to remove the wallet', { error: error instanceof Error ? error.name : 'unknown' })
      setFailed(true)
    } finally {
      setRemoving(false)
    }
  }, [request, wallet, logger])

  return { remove, isRemoving, failed, gateProps }
}
