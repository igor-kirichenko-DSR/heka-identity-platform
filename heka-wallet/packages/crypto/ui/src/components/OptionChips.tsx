import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native'

const useStyles = ({ Spacing, BorderRadius, BorderWidth, ColorPalette, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    // A horizontal ScrollView grows by default; the row must keep the height of its chips.
    scroll: { flexGrow: 0, flexShrink: 0 },
    row: { gap: Spacing.xs, paddingVertical: Spacing.xs },
    chip: {
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.big,
      borderWidth: BorderWidth.small,
      borderColor: ColorPalette.grayscale.mediumGrey,
    },
    selected: { backgroundColor: ColorPalette.brand.primary, borderColor: ColorPalette.brand.primary },
    text: { ...TextTheme.normal },
    selectedText: { color: ColorPalette.grayscale.white },
  })

export interface ChipOption {
  id: string
  label: string
}

interface Props {
  options: ChipOption[]
  selectedId?: string
  onSelect: (id: string) => void
  testIdPrefix: string
}

/** One choice out of a few, as a row of chips; the base of the chain switcher and the asset and fee pickers. */
export const OptionChips: React.FC<Props> = ({ options, selectedId, onSelect, testIdPrefix }) => {
  const styles = useStyles(useHekaTheme())

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => {
        const selected = option.id === selectedId
        return (
          <TouchableOpacity
            key={option.id}
            style={[styles.chip, selected && styles.selected]}
            onPress={() => onSelect(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            testID={testIdWithKey(`${testIdPrefix}-${option.label}`)}
          >
            <Text style={[styles.text, selected && styles.selectedText]}>{option.label}</Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}
