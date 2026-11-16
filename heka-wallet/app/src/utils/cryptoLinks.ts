import type { RootStackParams } from '../navigators/types'
import type { CryptoMainStackParams } from '@heka-wallet/crypto-ui'
import type { NavigatorScreenParams } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import { Stacks as BifoldStacks } from '@bifold/core'
import { isSigningLink, parseSigningUri } from '@heka-wallet/crypto-core'
import { CryptoScreens, CryptoStacks, prefillFromEip681, useOptionalCrypto } from '@heka-wallet/crypto-ui'
import { useNavigation } from '@react-navigation/core'
import { useCallback } from 'react'

import { Stacks, TabStacks } from '../navigators/types'

const EIP681_SCHEME = 'ethereum:'

export const isPaymentLink = (url: string): boolean => url.trim().toLowerCase().startsWith(EIP681_SCHEME)

/** A payment link (`ethereum:`) or a signing request (`heka-sign:`). */
export const isCryptoLink = (url: string): boolean => isPaymentLink(url) || isSigningLink(url)

/**
 * Opens Send, prefilled, for an `ethereum:` payment link, or SignRequest for a `heka-sign:` link. Undefined while the
 * payment module is off, so the caller keeps today's path. Throws for a chain or token the wallet does not support
 * and for a malformed or insecure signing link.
 */
export const useCryptoLinkHandler = (): ((url: string) => void) | undefined => {
  const crypto = useOptionalCrypto()
  const navigation = useNavigation<StackNavigationProp<RootStackParams>>()

  const openMain = useCallback(
    (params: NavigatorScreenParams<CryptoMainStackParams>) => {
      navigation.navigate(Stacks.BifoldStack, {
        screen: BifoldStacks.TabStack,
        params: {
          screen: TabStacks.CryptoStack,
          params: {
            screen: CryptoStacks.Main,
            // initial: false keeps Home under the screen; without it that screen is the only one and there is no way back.
            params: { ...params, initial: false },
          },
        },
      })
    },
    [navigation]
  )

  const open = useCallback(
    (url: string) => {
      if (!crypto) return
      if (isSigningLink(url)) {
        const requestUrl = parseSigningUri(url, __DEV__)
        openMain({ screen: CryptoScreens.SignRequest, params: { requestUrl } })
        return
      }
      const currentChainId = crypto.accounts.currentChainId
      if (!currentChainId) throw new Error('The payment wallet is not ready')
      const { chainId, prefill } = prefillFromEip681(url.trim(), crypto.registry, currentChainId)
      crypto.accounts.setChain(chainId)
      openMain({ screen: CryptoScreens.Send, params: { prefill } })
    },
    [crypto, openMain]
  )

  return crypto ? open : undefined
}
