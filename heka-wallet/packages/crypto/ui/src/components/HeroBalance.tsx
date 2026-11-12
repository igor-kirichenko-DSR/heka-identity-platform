import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

const useStyles = ({ Spacing, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    container: { alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.xxxs },
    label: { ...TextTheme.labelSubtitle },
    amount: { ...TextTheme.headingThree },
    spinner: { position: 'absolute' },
  })

interface Props {
  /** What the amount is, e.g. "USDC balance". */
  label: string
  /** The formatted amount; undefined while the balance is loading. */
  amount?: string
  testID?: string
}

/** The big balance at the top of the Home card, with a spinner over its place while it loads. */
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
