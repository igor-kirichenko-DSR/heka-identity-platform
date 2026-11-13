import type { AssetDescriptor, ChainDescriptor, ChainId } from '@heka-wallet/crypto-core'

import { useCallback, useState } from 'react'

import { useCrypto } from '../provider/CryptoContext'

export interface AssetBalance {
  asset: AssetDescriptor
  /** Undefined until the first poll has answered. */
  balance?: bigint
}

/** The hero balance is the chain's first stablecoin, else the native asset: amounts of different assets are never summed. */
const pickHero = (rows: AssetBalance[]): AssetBalance | undefined => rows.find((row) => row.asset.stable) ?? rows[0]

/** Home state over the stores; read inside an observer screen so it follows them. */
export const useHome = () => {
  const { accounts, balances, registry, logger } = useCrypto()
  const [isRefreshing, setRefreshing] = useState(false)
  const account = accounts.currentAccount
  const chain: ChainDescriptor | undefined = accounts.currentChainId
    ? registry.get(accounts.currentChainId).chain
    : undefined
  const amounts = account ? balances.balancesOf(account) : undefined
  const rows: AssetBalance[] = chain
    ? [chain.nativeAsset, ...chain.assets].map((asset) => ({ asset, balance: amounts?.[asset.id] }))
    : []

  const hero = pickHero(rows)
  const others = rows.filter((row) => row !== hero)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await balances.refresh()
    } finally {
      setRefreshing(false)
    }
  }, [balances])

  const setChain = useCallback(
    (chainId: ChainId) => {
      try {
        accounts.setChain(chainId)
      } catch (error) {
        logger.error('Failed to switch chain', { chainId, error: String(error) })
      }
    },
    [accounts, logger]
  )

  return {
    account,
    chain,
    chains: registry.list().map((adapter) => adapter.chain),
    rows,
    hero,
    others,
    hasBalanceError: !!balances.error,
    isRefreshing,
    refresh,
    setChain,
  }
}
