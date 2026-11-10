import { generatePhrase } from '@heka-wallet/crypto-core'
import { useEffect, useState } from 'react'

import { NEW_PHRASE_WORDS } from '../constants'
import { useRegisterFlow } from '../navigators/RegisterFlowContext'

/** A new phrase, made once per register flow and kept in memory until it is verified. */
export const useNewMnemonic = (): string[] => {
  const { phrase, setPhrase } = useRegisterFlow()
  const [current] = useState(() => phrase ?? generatePhrase(NEW_PHRASE_WORDS))

  useEffect(() => {
    if (phrase !== current) setPhrase(current)
  }, [phrase, current, setPhrase])

  return current.split(' ')
}
