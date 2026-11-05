import type { FeeMode, FeeQuote } from '@heka-wallet/crypto-core'

import React from 'react'
import { useTranslation } from 'react-i18next'

import { formatAmount } from '../utils/format'

import { SegmentedControl } from './SegmentedControl'

interface Props {
  modes: FeeMode[]
  selected: FeeMode
  /** The native fee asset's symbol: ETH, or HBAR on Hedera. */
  nativeSymbol: string
  /** The quote of the selected mode; its amount is shown under that segment. */
  quote?: FeeQuote
  onSelect: (mode: FeeMode) => void
}

/** Shown only when there is a choice: USDC fees exist only where the chain has a paymaster (F08). */
export const FeeModePicker: React.FC<Props> = ({ modes, selected, nativeSymbol, quote, onSelect }) => {
  const { t } = useTranslation()
  if (modes.length < 2) return null

  // In paymaster mode the permit ceiling is what can be charged.
  const feeAmountText = (fee: FeeQuote): string => {
    if (fee.max === undefined) return formatAmount(fee.amount, fee.asset)
    return t('Crypto.Fee.UpToShort', { amount: formatAmount(fee.max, fee.asset) })
  }
  const selectedAmount = quote && feeAmountText(quote)

  return (
    <SegmentedControl
      options={modes.map((mode) => ({
        id: mode,
        label: mode === 'native' ? nativeSymbol : t('Crypto.Fee.Usdc'),
        subLabel: mode === selected ? selectedAmount : undefined,
      }))}
      selectedId={selected}
      onSelect={(id) => onSelect(id as FeeMode)}
      testIdPrefix="CryptoFeeMode"
    />
  )
}
