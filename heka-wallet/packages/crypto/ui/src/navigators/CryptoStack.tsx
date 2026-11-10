import React from 'react'
import { View } from 'react-native'

import { CryptoNavigator } from './CryptoNavigator'
import { RegisterFlowProvider } from './RegisterFlowContext'

interface Props {
  /** Space kept free at the bottom, for a host whose tab bar floats over the content. */
  bottomInset?: number
}

/** The payment module's root navigator; the app nests it in its Payments tab. */
export const CryptoStack: React.FC<Props> = ({ bottomInset = 0 }) => (
  <RegisterFlowProvider>
    <View style={{ flex: 1, paddingBottom: bottomInset }} testID="CryptoStackContainer">
      <CryptoNavigator />
    </View>
  </RegisterFlowProvider>
)
