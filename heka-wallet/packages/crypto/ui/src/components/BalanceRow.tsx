import type { AssetDescriptor } from '@heka-wallet/crypto-core'

import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { formatAmount, LIST_FRACTION_DIGITS } from '../utils/format'

const useStyles = ({ Spacing, TextTheme, BorderWidth, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderBottomWidth: BorderWidth.small,
      borderBottomColor: ColorPalette.grayscale.lightGrey,
    },
    name: { ...TextTheme.normal },
    amount: { ...TextTheme.bold },
  })

interface Props {
  asset: AssetDescriptor
  balance?: bigint
}

export const BalanceRow: React.FC<Props> = ({ asset, balance }) => {
  const styles = useStyles(useHekaTheme())

  return (
    <View style={styles.row} testID={testIdWithKey(`CryptoBalance-${asset.symbol}`)}>
      <Text style={styles.name}>{asset.name}</Text>
      {balance === undefined ? (
        <ActivityIndicator />
      ) : (
        <Text style={styles.amount}>{formatAmount(balance, asset, LIST_FRACTION_DIGITS)}</Text>
      )}
    </View>
  )
}
