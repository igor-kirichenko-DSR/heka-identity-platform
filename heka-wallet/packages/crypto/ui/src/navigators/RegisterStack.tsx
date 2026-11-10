import type { CryptoRegisterStackParams } from './types'

import { createStackNavigator } from '@react-navigation/stack'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { ImportWallet } from '../screens/register/ImportWallet'
import { NewMnemonic } from '../screens/register/NewMnemonic'
import { RegisterDone } from '../screens/register/RegisterDone'
import { RegisterIntro } from '../screens/register/RegisterIntro'
import { VerifyMnemonicScreen } from '../screens/register/VerifyMnemonicScreen'

import { CryptoScreens } from './routes'

const Stack = createStackNavigator<CryptoRegisterStackParams>()

const NO_TITLE = { title: '' }
// Done follows a stored seed: going back would show the phrase screens again.
const DONE_OPTIONS = { title: '', headerLeft: () => null, gestureEnabled: false }

export const RegisterStack: React.FC = () => {
  const { t } = useTranslation()

  return (
    <Stack.Navigator initialRouteName={CryptoScreens.RegisterIntro}>
      <Stack.Screen
        name={CryptoScreens.RegisterIntro}
        component={RegisterIntro}
        options={{ title: t('Crypto.Title') }}
      />
      <Stack.Screen name={CryptoScreens.NewMnemonic} component={NewMnemonic} options={NO_TITLE} />
      <Stack.Screen name={CryptoScreens.VerifyMnemonic} component={VerifyMnemonicScreen} options={NO_TITLE} />
      <Stack.Screen name={CryptoScreens.ImportWallet} component={ImportWallet} options={NO_TITLE} />
      <Stack.Screen name={CryptoScreens.RegisterDone} component={RegisterDone} options={DONE_OPTIONS} />
    </Stack.Navigator>
  )
}
