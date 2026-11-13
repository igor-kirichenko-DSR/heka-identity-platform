import type { CryptoRegisterStackParams } from '../../navigators/types'
import type { StackScreenProps } from '@react-navigation/stack'

import React, { useEffect } from 'react'

import { useRegisterFlow } from '../../navigators/RegisterFlowContext'
import { CryptoScreens } from '../../navigators/routes'

import { VerifyMnemonic } from './VerifyMnemonic'

type Props = StackScreenProps<CryptoRegisterStackParams, CryptoScreens.VerifyMnemonic>

/**
 * Without a phrase in memory (e.g. restored navigation state) there is nothing to verify: start again.
 * Not while the seed is being stored: Done clears the phrase while this screen is still animating out.
 */
export const VerifyMnemonicScreen: React.FC<Props> = ({ navigation }) => {
  const { phrase, isFinishing } = useRegisterFlow()

  useEffect(() => {
    if (!phrase && !isFinishing) navigation.replace(CryptoScreens.NewMnemonic)
  }, [phrase, isFinishing, navigation])

  return phrase ? <VerifyMnemonic phrase={phrase} /> : null
}
