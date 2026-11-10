import type { CryptoServices } from './createCryptoServices'

import { createContext, useContext } from 'react'

export const CryptoContext = createContext<CryptoServices | null>(null)

export const useCrypto = (): CryptoServices => {
  const services = useContext(CryptoContext)
  if (!services) throw new Error('useCrypto must be used inside CryptoProvider')
  return services
}
