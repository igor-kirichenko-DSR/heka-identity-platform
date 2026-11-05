import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'

import { CANDIDATE_CHIP_MIN_WIDTH } from '../constants'

const useStyles = ({ Spacing, BorderRadius, BorderWidth, ColorPalette, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    chip: {
      minWidth: CANDIDATE_CHIP_MIN_WIDTH,
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.big,
      borderWidth: BorderWidth.small,
      borderColor: ColorPalette.brand.primary,
      backgroundColor: ColorPalette.grayscale.white,
    },
    placed: { borderColor: ColorPalette.grayscale.lightGrey },
    text: { ...TextTheme.normal },
    placedText: { color: ColorPalette.grayscale.mediumGrey },
  })

interface Props {
  word: string
  /** Already put in a slot: shown muted; tapping takes it back. */
  placed: boolean
  onPress: () => void
  testID?: string
}

/** A word to put back into the phrase: an outlined chip. */
export const CandidateChip: React.FC<Props> = ({ word, placed, onPress, testID }) => {
  const styles = useStyles(useHekaTheme())

  return (
    <TouchableOpacity
      style={[styles.chip, placed && styles.placed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: placed }}
      testID={testID}
    >
      <Text style={[styles.text, placed && styles.placedText]}>{word}</Text>
    </TouchableOpacity>
  )
}
