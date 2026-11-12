import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

const useStyles = ({ Spacing, BorderRadius, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    block: {
      flex: 1,
      alignItems: 'center',
      padding: Spacing.sm,
      gap: Spacing.xxxs,
      borderRadius: BorderRadius.medium,
      backgroundColor: ColorPalette.grayscale.veryLightGrey,
    },
    label: { ...TextTheme.labelSubtitle },
    amount: { ...TextTheme.bold },
  })

interface Props {
  label: string
  /** The formatted amount; undefined while the balance is loading. */
  amount?: string
  testID?: string
}

/** One secondary asset under the hero balance: its name and amount. */
export const AssetBalanceBlock: React.FC<Props> = ({ label, amount, testID }) => {
  const styles = useStyles(useHekaTheme())

  return (
    <View style={styles.block} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      {amount === undefined ? <ActivityIndicator /> : <Text style={styles.amount}>{amount}</Text>}
    </View>
  )
}
