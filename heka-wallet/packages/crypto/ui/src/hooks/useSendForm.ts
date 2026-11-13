import type { SendPrefill } from '../navigators/types'
import type { AssetDescriptor, FeeMode, TransferRequest } from '@heka-wallet/crypto-core'

import { formatUnits, parseUnits } from '@heka-wallet/crypto-core'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useCrypto } from '../provider/CryptoContext'
import { checkFunds, maxAmount } from '../utils/sendChecks'

import { useFeeQuote } from './useFeeQuote'

const ZERO = BigInt(0)

/** Amount text → bigint in the asset's smallest unit; undefined for empty, invalid or too many decimals. */
const toUnits = (text: string, asset: AssetDescriptor | undefined): bigint | undefined => {
  if (!asset || !text.trim()) return undefined
  try {
    return parseUnits(text.trim(), asset.decimals)
  } catch {
    // Invalid input is shown as a form error by the caller, not logged.
    return undefined
  }
}

/** The Send form: recipient, asset, amount, fee mode, fee quote and the funds check, all on bigint. */
export const useSendForm = () => {
  const { accounts, balances, registry, transactions } = useCrypto()
  const account = accounts.currentAccount
  const adapter = account ? registry.get(account.chainId) : undefined
  const chain = adapter?.chain
  const assets = useMemo(() => (chain ? [chain.nativeAsset, ...chain.assets] : []), [chain])
  const feeModes: FeeMode[] = chain?.features.paymaster ? ['native', 'usdc-paymaster'] : ['native']

  const [assetId, setAssetId] = useState<string>()
  const [to, setTo] = useState('')
  const [amountText, setAmountText] = useState('')
  const [feeMode, setFeeMode] = useState<FeeMode>('native')
  // "Max" needs the fee, and the fee needs an amount: max fills the balance first and is corrected once quoted.
  const [maxPending, setMaxPending] = useState(false)
  const asset = assets.find((item) => item.id === assetId) ?? assets[0]

  const validation = adapter && to.trim() ? adapter.validateAddress(to.trim()) : undefined
  const recipient = validation?.ok ? (validation.normalized ?? to.trim()) : undefined
  const amount = toUnits(amountText, asset)
  const amountInvalid = amountText.trim() !== '' && amount === undefined
  const amounts = account ? balances.balancesOf(account) : undefined
  const held = useMemo(() => amounts ?? {}, [amounts])

  const request: TransferRequest | undefined =
    account && asset && recipient && amount !== undefined && amount > ZERO
      ? { from: account, to: recipient, asset, amount, feeMode: feeModes.includes(feeMode) ? feeMode : 'native' }
      : undefined
  const { quote, isQuoting, failed: quoteFailed } = useFeeQuote(adapter, request)
  const funds =
    request && quote ? checkFunds({ asset: request.asset, amount: request.amount, quote, balances: held }) : undefined
  const hasPendingSend = account ? transactions.hasPendingSend(account) : false

  const setMax = useCallback(() => {
    if (!asset) return
    setAmountText(formatUnits(maxAmount(asset, held, quote), asset.decimals))
    setMaxPending(true)
  }, [asset, held, quote])

  useEffect(() => {
    if (!maxPending || !quote || !asset) return
    setAmountText(formatUnits(maxAmount(asset, held, quote), asset.decimals))
    setMaxPending(false)
  }, [maxPending, quote, asset, held])

  const editAmount = useCallback((text: string) => {
    setMaxPending(false)
    setAmountText(text)
  }, [])

  const selectAsset = useCallback((id: string) => {
    setMaxPending(false)
    setAssetId(id)
  }, [])

  const applyPrefill = useCallback(
    (prefill: SendPrefill) => {
      const target = assets.find((item) => item.id === prefill.assetId) ?? asset
      if (prefill.assetId && target) setAssetId(target.id)
      if (prefill.to) setTo(prefill.to)
      if (prefill.amount && target) setAmountText(formatUnits(BigInt(prefill.amount), target.decimals))
    },
    [assets, asset]
  )

  return {
    account,
    chain,
    assets,
    asset,
    selectAsset,
    to,
    setTo,
    addressInvalid: !!validation && !validation.ok,
    addressWarning: validation?.warning,
    isNewRecipient: !!account && !!recipient && !transactions.isKnownRecipient(account, recipient),
    amountText,
    setAmountText: editAmount,
    amountInvalid,
    setMax,
    feeModes,
    feeMode: request?.feeMode ?? feeMode,
    setFeeMode,
    quote,
    isQuoting,
    quoteFailed,
    funds,
    hasPendingSend,
    request,
    canSend: !!request && !!quote && funds === 'ok' && !hasPendingSend,
    applyPrefill,
  }
}

export type SendForm = ReturnType<typeof useSendForm>
