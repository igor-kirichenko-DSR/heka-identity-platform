import type { SendPrefill } from '../navigators/types'
import type { AdapterRegistry, ChainId } from '@heka-wallet/crypto-core'

import { parseEip681, sameAddress } from '@heka-wallet/crypto-core'

export class PaymentRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaymentRequestError'
  }
}

/**
 * An EIP-681 payment request → the chain it names (or `currentChainId`) and the Send form values.
 * Throws for a chain no adapter handles, or a token the chain does not list.
 */
export const prefillFromEip681 = (
  uri: string,
  registry: AdapterRegistry,
  currentChainId: ChainId
): { chainId: ChainId; prefill: SendPrefill } => {
  const request = parseEip681(uri)
  const chainId = request.chainId ?? currentChainId
  if (!registry.has(chainId)) throw new PaymentRequestError('Payment request for an unsupported chain')
  const { chain } = registry.get(chainId)
  const asset = request.token
    ? chain.assets.find((item) => item.address && sameAddress(item.address, request.token ?? ''))
    : chain.nativeAsset
  if (!asset) throw new PaymentRequestError('Payment request for an unknown token')
  return { chainId, prefill: { to: request.to, assetId: asset.id, amount: request.amount?.toString() } }
}
