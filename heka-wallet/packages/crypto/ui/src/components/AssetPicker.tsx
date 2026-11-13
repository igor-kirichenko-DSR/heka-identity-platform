import type { AssetDescriptor } from '@heka-wallet/crypto-core'

import React from 'react'

import { SegmentedControl } from './SegmentedControl'

interface Props {
  assets: AssetDescriptor[]
  selectedId?: string
  onSelect: (assetId: string) => void
}

export const AssetPicker: React.FC<Props> = ({ assets, selectedId, onSelect }) => (
  <SegmentedControl
    options={assets.map((asset) => ({ id: asset.id, label: asset.symbol }))}
    selectedId={selectedId}
    onSelect={onSelect}
    testIdPrefix="CryptoAsset"
  />
)
