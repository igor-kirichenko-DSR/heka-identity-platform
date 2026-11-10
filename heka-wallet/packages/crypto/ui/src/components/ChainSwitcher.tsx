import type { ChainDescriptor, ChainId } from '@heka-wallet/crypto-core'

import React from 'react'

import { OptionChips } from './OptionChips'

interface Props {
  chains: ChainDescriptor[]
  currentId?: ChainId
  onSelect: (chainId: ChainId) => void
}

/** Hidden with a single chain: there is nothing to switch to. */
export const ChainSwitcher: React.FC<Props> = ({ chains, currentId, onSelect }) =>
  chains.length > 1 ? (
    <OptionChips
      options={chains.map((chain) => ({ id: chain.id, label: chain.name }))}
      selectedId={currentId}
      onSelect={(id) => onSelect(id as ChainId)}
      testIdPrefix="CryptoChain"
    />
  ) : null
