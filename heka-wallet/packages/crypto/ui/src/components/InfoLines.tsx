import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

const useStyles = ({ Spacing, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    container: { gap: Spacing.md, paddingVertical: Spacing.md },
    line: { ...TextTheme.normal },
  })

interface Props {
  lines: string[]
}

/** The explaining text of a register screen; its title is in the header. */
export const InfoLines: React.FC<Props> = ({ lines }) => {
  const styles = useStyles(useHekaTheme())

  return (
    <View style={styles.container}>
      {lines.map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
    </View>
  )
}
