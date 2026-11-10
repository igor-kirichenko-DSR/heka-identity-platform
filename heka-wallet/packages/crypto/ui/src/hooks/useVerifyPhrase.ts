import { useCallback } from 'react'

import { useCrypto } from '../provider/CryptoContext'

import { useStoreSeed } from './useStoreSeed'
import { useVerifyMnemonic } from './useVerifyMnemonic'

/** The verify screen's logic: tap-to-order check, then the phrase is stored, only once it is correct. */
export const useVerifyPhrase = (phrase: string) => {
  const { wallet } = useCrypto()
  const verify = useVerifyMnemonic(phrase)
  const { save, isSaving, error } = useStoreSeed()
  const { isCorrect } = verify

  const store = useCallback(async () => {
    if (!isCorrect) return
    await save(() => wallet.importPhrase(phrase))
  }, [isCorrect, save, wallet, phrase])

  return { ...verify, store, isSaving, error }
}
