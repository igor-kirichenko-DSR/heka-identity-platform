import type { CryptoRegisterStackParams } from './types'

import { useHekaTheme } from '@heka-wallet/shared'
import { createStackNavigator } from '@react-navigation/stack'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { ImportWallet } from '../screens/register/ImportWallet'
import { NewMnemonic } from '../screens/register/NewMnemonic'
import { RegisterDone } from '../screens/register/RegisterDone'
import { RegisterIntro } from '../screens/register/RegisterIntro'
import { VerifyMnemonicScreen } from '../screens/register/VerifyMnemonicScreen'

import { CryptoScreens } from './routes'
import { useLightHeader } from './useLightHeader'

const Stack = createStackNavigator<CryptoRegisterStackParams>()

// Done follows a stored seed: going back would show the phrase screens again.
const DONE_OPTIONS = { headerLeft: () => null, gestureEnabled: false }

export const RegisterStack: React.FC = () => {
  const { t } = useTranslation()
  const { ColorPalette } = useHekaTheme()
  const white = ColorPalette.grayscale.white
  const header = useLightHeader(white)
  const pageHeader = useLightHeader()

  return (
    <Stack.Navigator
      initialRouteName={CryptoScreens.RegisterIntro}
      screenOptions={{ ...header, cardStyle: { backgroundColor: white } }}
    >
      <Stack.Screen
        name={CryptoScreens.RegisterIntro}
        component={RegisterIntro}
        // The empty Coins card sits on the page ground, like Home.
        options={{
          title: t('Crypto.Title'),
          headerStyle: pageHeader.headerStyle,
          cardStyle: { backgroundColor: ColorPalette.brand.primaryBackground },
        }}
      />
      <Stack.Screen
        name={CryptoScreens.NewMnemonic}
        component={NewMnemonic}
        options={{ title: t('Crypto.Register.NewMnemonic.Title') }}
      />
      <Stack.Screen
        name={CryptoScreens.VerifyMnemonic}
        component={VerifyMnemonicScreen}
        options={{ title: t('Crypto.Register.VerifyMnemonic.Title') }}
      />
      <Stack.Screen
        name={CryptoScreens.ImportWallet}
        component={ImportWallet}
        options={{ title: t('Crypto.Import.Title') }}
      />
      <Stack.Screen
        name={CryptoScreens.RegisterDone}
        component={RegisterDone}
        options={{ ...DONE_OPTIONS, title: t('Crypto.Register.Done.Title') }}
      />
    </Stack.Navigator>
  )
}
