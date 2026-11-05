import { CryptoProvider } from '@heka-wallet/crypto-ui'
import React, { type PropsWithChildren } from 'react'

import { useCryptoHost } from '../../hooks/useCryptoHost'

/** Mounts the payment module's services around the app. Rendered only when ENABLE_CRYPTO_MODULE is on. */
export const CryptoHost: React.FC<PropsWithChildren> = ({ children }) => (
  <CryptoProvider {...useCryptoHost()}>{children}</CryptoProvider>
)
