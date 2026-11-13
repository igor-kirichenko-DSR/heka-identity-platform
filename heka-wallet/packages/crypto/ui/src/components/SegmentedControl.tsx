import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

const useStyles = ({ Spacing, BorderRadius, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      padding: Spacing.xxxs,
      gap: Spacing.xxxs,
      borderRadius: BorderRadius.medium,
      backgroundColor: ColorPalette.grayscale.darkGrey,
    },
    segment: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.small,
    },
    selected: { backgroundColor: ColorPalette.grayscale.white },
    label: { ...TextTheme.bold, color: ColorPalette.grayscale.white },
    subLabel: { ...TextTheme.caption, color: ColorPalette.grayscale.lightGrey },
    selectedText: { color: ColorPalette.grayscale.black },
  })

export interface SegmentOption {
  id: string
  label: string
  /** Shown under the label, e.g. the fee amount. */
  subLabel?: string
}

interface Props {
  options: SegmentOption[]
  selectedId?: string
  onSelect: (id: string) => void
  /** Each segment gets testIdWithKey(`${testIdPrefix}-${label}`). */
  testIdPrefix: string
}

/** One choice out of a few as a dark bar of segments; the selected one is light. */
export const SegmentedControl: React.FC<Props> = ({ options, selectedId, onSelect, testIdPrefix }) => {
  const styles = useStyles(useHekaTheme())

  return (
    <View style={styles.bar}>
      {options.map((option) => {
        const selected = option.id === selectedId
        return (
          <TouchableOpacity
            key={option.id}
            style={[styles.segment, selected && styles.selected]}
            onPress={() => onSelect(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            testID={testIdWithKey(`${testIdPrefix}-${option.label}`)}
          >
            <Text style={[styles.label, selected && styles.selectedText]}>{option.label}</Text>
            {!!option.subLabel && (
              <Text style={[styles.subLabel, selected && styles.selectedText]}>{option.subLabel}</Text>
            )}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}
