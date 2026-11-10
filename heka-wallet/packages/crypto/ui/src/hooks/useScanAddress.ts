import type { CryptoMainStackParams, SendPrefill } from '../navigators/types'
import type { StackNavigationProp } from '@react-navigation/stack'

import { parseEip681, sameAddress } from '@heka-wallet/crypto-core'
import { useNavigation } from '@react-navigation/native'
import { useCallback, useState } from 'react'

import { CryptoScreens } from '../navigators/routes'
import { useCrypto } from '../provider/CryptoContext'

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
      const { chain } = registry.get(chainId)
      if (!value.startsWith(EIP681_PREFIX)) {
        return registry.get(chainId).validateAddress(value).ok ? { to: value } : undefined
      }
      const request = parseEip681(value)
      if (request.chainId && request.chainId !== chainId) throw new Error('Payment request for another chain')
      const asset = request.token
        ? chain.assets.find((item) => item.address && sameAddress(item.address, request.token ?? ''))
        : chain.nativeAsset
      if (!asset) throw new Error('Payment request for an unknown token')
      return { to: request.to, assetId: asset.id, amount: request.amount?.toString() }
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
