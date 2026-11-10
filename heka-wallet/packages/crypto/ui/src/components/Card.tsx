import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { StyleSheet, View } from 'react-native'

const useStyles = ({ Spacing, BorderRadius, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    card: {
      padding: Spacing.md,
      gap: Spacing.sm,
      borderRadius: BorderRadius.big,
      backgroundColor: ColorPalette.grayscale.white,
    },
  })

interface Props {
  children: React.ReactNode
  testID?: string
}

/** A white rounded card on the page ground; the Home and Send screens are stacks of these. */
export const Card: React.FC<Props> = ({ children, testID }) => {
  const styles = useStyles(useHekaTheme())

  return (
    <View style={styles.card} testID={testID}>
      {children}
    </View>
  )
}
