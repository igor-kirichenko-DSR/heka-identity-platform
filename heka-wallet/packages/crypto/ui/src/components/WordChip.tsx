import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'

const useStyles = ({ Spacing, BorderRadius, BorderWidth, ColorPalette, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    chip: {
      flexBasis: '30%',
      flexGrow: 1,
      margin: Spacing.xxxs,
      padding: Spacing.xs,
      alignItems: 'center',
      borderRadius: BorderRadius.extraSmall,
      borderWidth: BorderWidth.small,
      borderColor: ColorPalette.grayscale.mediumGrey,
      backgroundColor: ColorPalette.grayscale.white,
    },
    highlighted: { borderColor: ColorPalette.brand.highlight, borderWidth: BorderWidth.medium },
    selected: { backgroundColor: ColorPalette.grayscale.lightGrey },
    text: { ...TextTheme.normal, color: ColorPalette.grayscale.black },
  })

interface Props {
  word: string
  /** 1-based position shown before the word. */
  position?: number
  highlighted?: boolean
  selected?: boolean
  onPress?: () => void
  testID?: string
}

export const WordChip: React.FC<Props> = ({ word, position, highlighted, selected, onPress, testID }) => {
  const styles = useStyles(useHekaTheme())
  const label = position === undefined ? word : `${position}. ${word}`

  return (
    <TouchableOpacity
      style={[styles.chip, highlighted && styles.highlighted, selected && styles.selected]}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      testID={testID}
    >
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  )
}
