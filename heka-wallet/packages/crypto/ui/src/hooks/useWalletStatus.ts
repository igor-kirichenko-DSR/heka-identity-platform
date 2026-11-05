import { useCallback } from 'react'

import { useRegisterFlow } from '../navigators/RegisterFlowContext'
import { useCrypto } from '../provider/CryptoContext'

/** Which part of the crypto stack to show; read inside an observer so it follows the wallet store. */
export const useWalletStatus = () => {
  const { wallet } = useCrypto()
  const { isFinishing } = useRegisterFlow()

  const retry = useCallback(() => void wallet.load(), [wallet])

  return {
    isLoading: wallet.status === 'loading',
    failed: !!wallet.error,
    // Register until a seed exists and the holder has left the Done screen.
    showRegister: wallet.status === 'none' || isFinishing,
    retry,
  }
}
