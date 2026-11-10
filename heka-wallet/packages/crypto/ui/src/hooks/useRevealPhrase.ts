import { useNavigation } from '@react-navigation/native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCrypto } from '../provider/CryptoContext'

import { useAuthProof } from './useAuthProof'

/** Asks for a fresh PIN or biometry on open; the words exist only in this screen's state and go with it. */
export const useRevealPhrase = () => {
  const { keys, logger } = useCrypto()
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { request, gateProps } = useAuthProof(t('Crypto.Reveal.Confirm'))
  const [words, setWords] = useState<string[]>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const reveal = async () => {
      const proof = await request()
      if (cancelled) return
      if (!proof) {
        navigation.goBack()
        return
      }
      try {
        const phrase = await keys.revealMnemonic(proof)
        if (!cancelled) setWords(phrase.split(' '))
      } catch (error) {
        logger.error('Failed to reveal the recovery phrase', { error: error instanceof Error ? error.name : 'unknown' })
        if (!cancelled) setFailed(true)
      }
    }
    void reveal()
    return () => {
      cancelled = true
    }
  }, [request, keys, logger, navigation])

  return { words, failed, gateProps }
}
