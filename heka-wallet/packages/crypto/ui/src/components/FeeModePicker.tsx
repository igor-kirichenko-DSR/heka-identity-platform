import type { FeeMode } from '@heka-wallet/crypto-core'

import React from 'react'
import { useTranslation } from 'react-i18next'

import { OptionChips } from './OptionChips'

interface Props {
  modes: FeeMode[]
  selected: FeeMode
  /** The native fee asset's symbol: ETH, or HBAR on Hedera. */
  nativeSymbol: string
  onSelect: (mode: FeeMode) => void
}

/** Shown only when there is a choice: USDC fees exist only where the chain has a paymaster (F08). */
export const FeeModePicker: React.FC<Props> = ({ modes, selected, nativeSymbol, onSelect }) => {
  const { t } = useTranslation()
  if (modes.length < 2) return null

  return (
    <OptionChips
      options={modes.map((mode) => ({
        id: mode,
        label: mode === 'native' ? nativeSymbol : t('Crypto.Fee.Usdc'),
      }))}
      selectedId={selected}
      onSelect={(id) => onSelect(id as FeeMode)}
      testIdPrefix="CryptoFeeMode"
    />
  )
}
