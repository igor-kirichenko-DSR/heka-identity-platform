import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { type DimensionValue, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

const PERCENT = 100

const useStyles = ({ Spacing, BorderRadius, BorderWidth, ColorPalette, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    cell: { padding: Spacing.xxxs },
    chip: {
      padding: Spacing.xs,
      alignItems: 'center',
      borderRadius: BorderRadius.small,
      borderWidth: BorderWidth.small,
      borderColor: ColorPalette.grayscale.mediumGrey,
      backgroundColor: ColorPalette.grayscale.darkGrey,
    },
    highlighted: { borderColor: ColorPalette.grayscale.lightGrey, borderWidth: BorderWidth.medium },
    filled: { backgroundColor: ColorPalette.grayscale.white },
    text: { ...TextTheme.normal, color: ColorPalette.grayscale.white },
    filledText: { color: ColorPalette.grayscale.black },
  })

interface Props {
  word: string
  /** 1-based position shown before the word. */
  position?: number
  /** The next empty slot: a light border. */
  highlighted?: boolean
  /** A candidate already placed: white with black text. */
  selected?: boolean
  /** Lay the chips out in this many equal columns. Without it the chip is as wide as its text. */
  columns?: number
  minWidth?: number
  onPress?: () => void
  testID?: string
}

export const WordChip: React.FC<Props> = ({
  word,
  position,
  highlighted,
  selected,
  columns,
  minWidth,
  onPress,
  testID,
}) => {
  const styles = useStyles(useHekaTheme())
  const label = position === undefined ? word : `${position}. ${word}`
  const width: DimensionValue | undefined = columns ? `${PERCENT / columns}%` : undefined

  return (
    <TouchableOpacity
      style={[styles.cell, { width, minWidth }]}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      testID={testID}
    >
      <View style={[styles.chip, highlighted && styles.highlighted, selected && styles.filled]}>
        <Text style={[styles.text, selected && styles.filledText]}>{label}</Text>
      </View>
    </TouchableOpacity>
  )
}
