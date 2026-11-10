import type { AssetDescriptor } from '@heka-wallet/crypto-core'

import { buildEip681, eip155Reference } from '@heka-wallet/crypto-core'
import { useState } from 'react'

import { useCrypto } from '../provider/CryptoContext'

/** The Receive QR payload: EIP-681 with the chain id, and the token contract for an ERC-20 asset. */
export const useReceiveUri = () => {
  const { accounts, registry } = useCrypto()
  const account = accounts.currentAccount
  const chain = account ? registry.get(account.chainId).chain : undefined
  const assets: AssetDescriptor[] = chain ? [chain.nativeAsset, ...chain.assets] : []
  const [selectedId, setSelectedId] = useState<string>()
  const asset = assets.find((item) => item.id === selectedId) ?? assets[0]

  const isEvm = !!chain && eip155Reference(chain.id) !== undefined
  const uri =
    account && asset && isEvm
      ? buildEip681({
          chainId: account.chainId,
          to: account.address,
          token: asset.kind === 'erc20' ? asset.address : undefined,
        })
      : undefined

  return { account, chain, assets, asset, selectAsset: setSelectedId, uri }
}
