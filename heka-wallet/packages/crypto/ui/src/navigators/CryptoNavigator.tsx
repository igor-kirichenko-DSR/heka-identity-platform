import type { CryptoStackParams } from './types'

import { createStackNavigator } from '@react-navigation/stack'
import { observer } from 'mobx-react-lite'
import React from 'react'

import { WalletStatusView } from '../components/WalletStatusView'
import { useWalletStatus } from '../hooks/useWalletStatus'

import { MainStack } from './MainStack'
import { RegisterStack } from './RegisterStack'
import { CryptoStacks } from './routes'

const Stack = createStackNavigator<CryptoStackParams>()

/** Register or the wallet, as useWalletStatus decides; a spinner or retry until the status is known. */
export const CryptoNavigator: React.FC = observer(() => {
  const { isLoading, failed, showRegister, retry } = useWalletStatus()

  if (isLoading) return <WalletStatusView failed={failed} onRetry={retry} />

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {showRegister ? (
        <Stack.Screen name={CryptoStacks.Register} component={RegisterStack} />
      ) : (
        <Stack.Screen name={CryptoStacks.Main} component={MainStack} />
      )}
    </Stack.Navigator>
  )
})
