import React from 'react'

import { CryptoNavigator } from './CryptoNavigator'
import { RegisterFlowProvider } from './RegisterFlowContext'

/** The payment module's root navigator; the app nests it in its Payments tab (F06). */
export const CryptoStack: React.FC = () => (
  <RegisterFlowProvider>
    <CryptoNavigator />
  </RegisterFlowProvider>
)
