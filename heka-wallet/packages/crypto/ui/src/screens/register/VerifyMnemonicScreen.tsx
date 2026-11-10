import type { CryptoRegisterStackParams } from '../../navigators/types'
import type { StackScreenProps } from '@react-navigation/stack'

import React, { useEffect } from 'react'

import { useRegisterFlow } from '../../navigators/RegisterFlowContext'
import { CryptoScreens } from '../../navigators/routes'

import { VerifyMnemonic } from './VerifyMnemonic'

type Props = StackScreenProps<CryptoRegisterStackParams, CryptoScreens.VerifyMnemonic>

/** Without a phrase in memory (e.g. restored navigation state) there is nothing to verify: start again. */
export const VerifyMnemonicScreen: React.FC<Props> = ({ navigation }) => {
  const { phrase } = useRegisterFlow()

  useEffect(() => {
    if (!phrase) navigation.replace(CryptoScreens.NewMnemonic)
  }, [phrase, navigation])

  return phrase ? <VerifyMnemonic phrase={phrase} /> : null
}
