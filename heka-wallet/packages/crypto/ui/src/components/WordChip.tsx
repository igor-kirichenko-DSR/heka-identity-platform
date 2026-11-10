import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { type DimensionValue, StyleSheet, Text, View } from 'react-native'

import { WORD_TILE_MIN_HEIGHT } from '../constants'

const PERCENT = 100

const useStyles = ({ Spacing, BorderRadius, ColorPalette, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    cell: { padding: Spacing.xs },
    tile: {
      minHeight: WORD_TILE_MIN_HEIGHT,
      justifyContent: 'space-between',
      padding: Spacing.md,
      borderRadius: BorderRadius.big,
      backgroundColor: ColorPalette.brand.primaryBackground,
    },
    next: { backgroundColor: ColorPalette.brand.primary },
    wrong: { backgroundColor: ColorPalette.semantic.errorTransparent },
    position: { ...TextTheme.labelSubtitle },
    word: { ...TextTheme.normal },
    nextText: { color: ColorPalette.grayscale.white },
  })

interface Props {
  word: string
  /** 1-based position shown above the word. */
  position: number
  /** The next empty slot: a dark tile. */
  highlighted?: boolean
  /** A word put in the wrong place: a pink tile. */
  error?: boolean
  /** Lay the tiles out in this many equal columns. */
  columns: number
  testID?: string
}

/** One numbered tile of the recovery phrase grid. */
export const WordChip: React.FC<Props> = ({ word, position, highlighted, error, columns, testID }) => {
  const styles = useStyles(useHekaTheme())
  const width: DimensionValue = `${PERCENT / columns}%`

  return (
    <View
      style={[styles.cell, { width }]}
      accessibilityRole="text"
      accessibilityLabel={`${position}. ${word}`}
      testID={testID}
    >
      <View style={[styles.tile, highlighted && styles.next, error && styles.wrong]}>
        <Text style={[styles.position, highlighted && styles.nextText]}>{`${position}.`}</Text>
        <Text style={[styles.word, highlighted && styles.nextText]}>{word}</Text>
      </View>
    </View>
  )
}
