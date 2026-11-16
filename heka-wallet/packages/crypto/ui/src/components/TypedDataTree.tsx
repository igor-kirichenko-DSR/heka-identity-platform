import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { TREE_INDENT } from '../constants'
import { typedDataRows } from '../utils/typedDataRows'

const useStyles = ({ Spacing, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    container: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
    label: { ...TextTheme.labelTitle },
    text: { ...TextTheme.normal },
  })

interface Props {
  value: unknown
}

/** Typed-data fields as an indented tree of plain text; the requester's content is never interpreted. */
export const TypedDataTree: React.FC<Props> = ({ value }) => {
  const styles = useStyles(useHekaTheme())

  return (
    <View style={styles.container}>
      {typedDataRows(value).map((row) => (
        <View key={row.key} style={{ paddingLeft: (row.depth - 1) * TREE_INDENT }}>
          <Text style={styles.label}>{row.label}</Text>
          {row.text !== undefined && <Text style={styles.text}>{row.text}</Text>}
        </View>
      ))}
    </View>
  )
}
