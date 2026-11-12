import type { CryptoMainStackParams } from './types'

import { createStackNavigator } from '@react-navigation/stack'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { HomeHeaderActions } from '../components/HomeHeaderActions'
import { History } from '../screens/History'
import { Home } from '../screens/Home'
import { Receive } from '../screens/Receive'
import { RemoveWallet } from '../screens/RemoveWallet'
import { RevealPhrase } from '../screens/RevealPhrase'
import { ScanAddress } from '../screens/ScanAddress'
import { Send } from '../screens/Send'
import { Settings } from '../screens/Settings'

import { CryptoScreens } from './routes'

const Stack = createStackNavigator<CryptoMainStackParams>()

export const MainStack: React.FC = () => {
  const { t } = useTranslation()

  return (
    <Stack.Navigator initialRouteName={CryptoScreens.Home}>
      <Stack.Screen
        name={CryptoScreens.Home}
        component={Home}
        options={({ navigation }) => ({
          title: t('Crypto.Title'),
          headerRight: () => (
            <HomeHeaderActions
              onHistory={() => navigation.navigate(CryptoScreens.History)}
              onSettings={() => navigation.navigate(CryptoScreens.Settings)}
            />
          ),
        })}
      />
      <Stack.Screen name={CryptoScreens.Receive} component={Receive} options={{ title: t('Crypto.Receive.Header') }} />
      <Stack.Screen name={CryptoScreens.Send} component={Send} options={{ title: t('Crypto.Send.Header') }} />
      <Stack.Screen
        name={CryptoScreens.ScanAddress}
        component={ScanAddress}
        options={{ title: t('Crypto.Scan.Header') }}
      />
      <Stack.Screen name={CryptoScreens.History} component={History} options={{ title: t('Crypto.History.Header') }} />
      <Stack.Screen
        name={CryptoScreens.Settings}
        component={Settings}
        options={{ title: t('Crypto.Settings.Header') }}
      />
      <Stack.Screen
        name={CryptoScreens.RevealPhrase}
        component={RevealPhrase}
        options={{ title: t('Crypto.Reveal.Header') }}
      />
      <Stack.Screen
        name={CryptoScreens.RemoveWallet}
        component={RemoveWallet}
        options={{ title: t('Crypto.Remove.Header') }}
      />
    </Stack.Navigator>
  )
}
