import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

const useStyles = ({ Spacing, BorderRadius, BorderWidth, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    block: {
      flex: 1,
      alignItems: 'flex-start',
      padding: Spacing.md,
      gap: Spacing.xs,
      borderRadius: BorderRadius.big,
      borderWidth: BorderWidth.small,
      borderColor: ColorPalette.grayscale.lightGrey,
    },
    label: { ...TextTheme.labelSubtitle },
    amount: { ...TextTheme.normal },
  })

interface Props {
  label: string
  /** The formatted amount; undefined while the balance is loading. */
  amount?: string
  testID?: string
}

/** One secondary asset under the hero balance: its name and amount in an outlined block. */
export const AssetBalanceBlock: React.FC<Props> = ({ label, amount, testID }) => {
  const styles = useStyles(useHekaTheme())

  return (
    <View style={styles.block} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      {amount === undefined ? <ActivityIndicator /> : <Text style={styles.amount}>{amount}</Text>}
    </View>
  )
}
