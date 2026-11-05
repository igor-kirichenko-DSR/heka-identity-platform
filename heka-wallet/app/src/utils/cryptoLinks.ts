import type { RootStackParams } from '../navigators/types'
import type { StackNavigationProp } from '@react-navigation/stack'

import { Stacks as BifoldStacks } from '@bifold/core'
import { CryptoScreens, CryptoStacks, prefillFromEip681, useOptionalCrypto } from '@heka-wallet/crypto-ui'
import { useNavigation } from '@react-navigation/core'
import { useCallback } from 'react'

import { Stacks, TabStacks } from '../navigators/types'

const EIP681_SCHEME = 'ethereum:'

export const isCryptoLink = (url: string): boolean => url.trim().toLowerCase().startsWith(EIP681_SCHEME)

/**
 * Opens Send, prefilled, for an `ethereum:` payment link. Undefined while the payment module is off, so the caller
 * keeps today's path. Throws for a chain or token the wallet does not support.
 */
export const useCryptoLinkHandler = (): ((url: string) => void) | undefined => {
  const crypto = useOptionalCrypto()
  const navigation = useNavigation<StackNavigationProp<RootStackParams>>()

  const open = useCallback(
    (url: string) => {
      if (!crypto) return
      const currentChainId = crypto.accounts.currentChainId
      if (!currentChainId) throw new Error('The payment wallet is not ready')
      const { chainId, prefill } = prefillFromEip681(url.trim(), crypto.registry, currentChainId)
      crypto.accounts.setChain(chainId)
      navigation.navigate(Stacks.BifoldStack, {
        screen: BifoldStacks.TabStack,
        params: {
          screen: TabStacks.CryptoStack,
          params: {
            screen: CryptoStacks.Main,
            // initial: false keeps Home under Send; without it Send is the only screen and there is no way back.
            params: { screen: CryptoScreens.Send, params: { prefill }, initial: false },
          },
        },
      })
    },
    [crypto, navigation]
  )

  return crypto ? open : undefined
}
