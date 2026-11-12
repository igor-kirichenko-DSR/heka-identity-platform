import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { StyleSheet, View } from 'react-native'

import { type AssetBalance } from '../hooks/useHome'
import { formatAmount, LIST_FRACTION_DIGITS } from '../utils/format'

import { AssetBalanceBlock } from './AssetBalanceBlock'

const useStyles = ({ Spacing }: HekaTheme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  })

interface Props {
  rows: AssetBalance[]
}

/** The balances of some assets as a row of blocks; an amount is empty while its balance loads. */
export const AssetBalanceBlocks: React.FC<Props> = ({ rows }) => {
  const styles = useStyles(useHekaTheme())

  return (
    <View style={styles.row}>
      {rows.map(({ asset, balance }) => (
        <AssetBalanceBlock
          key={asset.id}
          label={asset.symbol}
          amount={balance === undefined ? undefined : formatAmount(balance, asset, LIST_FRACTION_DIGITS)}
          testID={testIdWithKey(`CryptoBalance-${asset.symbol}`)}
        />
      ))}
    </View>
  )
}
