import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

const useStyles = ({ Spacing, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    title: { ...TextTheme.headingFour, padding: Spacing.md },
  })

interface Props {
  title: string
  children: React.ReactNode
}

/** A titled group of ListItem rows. */
export const ListSection: React.FC<Props> = ({ title, children }) => {
  const styles = useStyles(useHekaTheme())

  return (
    <View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  )
}
