import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

const useStyles = ({ Spacing, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    container: { paddingVertical: Spacing.md, gap: Spacing.xs },
    label: { ...TextTheme.normal },
    amount: { ...TextTheme.headingOne },
    spinner: { position: 'absolute', alignSelf: 'flex-start' },
  })

interface Props {
  /** What the amount is, e.g. "USDC balance". */
  label: string
  /** The formatted amount; undefined while the balance is loading. */
  amount?: string
  testID?: string
}

/** The big balance in the Home card, with a spinner over its place while it loads. */
export const HeroBalance: React.FC<Props> = ({ label, amount, testID }) => {
  const styles = useStyles(useHekaTheme())
  const loading = amount === undefined

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.amount}>{loading ? ' ' : amount}</Text>
      {loading && <ActivityIndicator style={styles.spinner} />}
    </View>
  )
}
