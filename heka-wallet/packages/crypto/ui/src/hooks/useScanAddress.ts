import type { CryptoMainStackParams, SendPrefill } from '../navigators/types'
import type { StackNavigationProp } from '@react-navigation/stack'

import { useNavigation } from '@react-navigation/native'
import { useCallback, useState } from 'react'

import { CryptoScreens } from '../navigators/routes'
import { useCrypto } from '../provider/CryptoContext'
import { prefillFromEip681 } from '../utils/prefillFromEip681'

const EIP681_PREFIX = 'ethereum:'

/** A scanned EIP-681 payment request or a bare address → the Send form; another chain's request is refused. */
export const useScanAddress = () => {
  const { accounts, registry } = useCrypto()
  const navigation = useNavigation<StackNavigationProp<CryptoMainStackParams>>()
  const [error, setError] = useState<string>()

  const toPrefill = useCallback(
    (value: string): SendPrefill | undefined => {
      const chainId = accounts.currentChainId
      if (!chainId) return undefined
      if (!value.startsWith(EIP681_PREFIX)) {
        return registry.get(chainId).validateAddress(value).ok ? { to: value } : undefined
      }
      const request = prefillFromEip681(value, registry, chainId)
      if (request.chainId !== chainId) throw new Error('Payment request for another chain')
      return request.prefill
    },
    [accounts, registry]
  )

  const handleCodeScan = useCallback(
    async (value: string) => {
      try {
        const prefill = toPrefill(value.trim())
        if (!prefill) {
          setError('Crypto.Scan.NotAnAddress')
          return
        }
        navigation.navigate(CryptoScreens.Send, { prefill })
      } catch {
        // The reason is one of the cases above; the scanned value is not logged.
        setError('Crypto.Scan.Unsupported')
      }
    },
    [toPrefill, navigation]
  )

  return { handleCodeScan, error }
}
