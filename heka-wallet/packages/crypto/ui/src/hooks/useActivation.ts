import type { Account, AssetDescriptor, ChainAdapter } from '@heka-wallet/crypto-core'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCrypto } from '../provider/CryptoContext'

import { useAuthProof } from './useAuthProof'

const readState = async (adapter: ChainAdapter, account: Account) => {
  const activation = adapter.activationState ? await adapter.activationState(account) : 'active'
  const disabled: AssetDescriptor[] = []
  if (adapter.isAssetEnabled) {
    for (const asset of adapter.chain.assets) {
      if (!(await adapter.isAssetEnabled(account, asset))) disabled.push(asset)
    }
  }
  return { isPending: activation === 'pending', disabled }
}

/**
 * Hedera specifics (F05) shown only when the adapter offers them: an account that activates on its first deposit,
 * and tokens that must be enabled (HTS association, paid in HBAR) before they can be received.
 */
export const useActivation = (current: Account | undefined) => {
  const { registry, keys, logger } = useCrypto()
  const { t } = useTranslation()
  const auth = useAuthProof(t('Crypto.Home.EnableAssetConfirm'))
  const [isPending, setPending] = useState(false)
  const [disabledAssets, setDisabled] = useState<AssetDescriptor[]>([])
  const [enabling, setEnabling] = useState<string>()
  const [failed, setFailed] = useState(false)
  // Keyed by value: a store getter may hand out a new Account object on every render.
  const chainId = current?.chainId
  const address = current?.address
  const index = current?.index
  const account = useMemo(
    () => (chainId && address && index !== undefined ? { chainId, address, index } : undefined),
    [chainId, address, index]
  )
  const adapter = account ? registry.get(account.chainId) : undefined

  const load = useCallback(async () => {
    if (!adapter || !account) return
    try {
      const state = await readState(adapter, account)
      setPending(state.isPending)
      setDisabled(state.disabled)
    } catch (error) {
      logger.warn('Failed to read the account activation', { chainId: account.chainId, error: String(error) })
    }
  }, [adapter, account, logger])

  useEffect(() => {
    setPending(false)
    setDisabled([])
    void load()
  }, [load])

  const enable = useCallback(
    async (asset: AssetDescriptor) => {
      if (!adapter?.enableAsset || !account) return
      setFailed(false)
      if (!(await auth.request())) return
      setEnabling(asset.id)
      try {
        await adapter.enableAsset(account, asset, keys)
        await load()
      } catch (error) {
        logger.error('Failed to enable an asset', { assetId: asset.id, error: String(error) })
        setFailed(true)
      } finally {
        setEnabling(undefined)
      }
    },
    [adapter, account, auth, keys, load, logger]
  )

  return { isPending, disabledAssets, enabling, failed, enable, reload: load, gateProps: auth.gateProps }
}
