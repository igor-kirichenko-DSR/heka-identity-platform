import { BootstrapIcon, type IconName, IconSizes, type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

const useStyles = ({ Spacing, BorderWidth, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderTopWidth: BorderWidth.small,
      borderTopColor: ColorPalette.grayscale.lightGrey,
    },
    texts: { flex: 1 },
    label: { ...TextTheme.labelTitle },
    paragraph: { ...TextTheme.labelSubtitle },
  })

interface Props {
  label: string
  paragraph?: string
  icon?: IconName
  /** Whatever sits at the right edge: a chip, a check, a trash icon. */
  right?: React.ReactNode
  /** Without it the row is not pressable. */
  onPress?: () => void
  testID?: string
}

/** A row of a list: left icon, label with a paragraph under it, right slot. */
export const ListItem: React.FC<Props> = ({ label, paragraph, icon, right, onPress, testID }) => {
  const theme = useHekaTheme()
  const styles = useStyles(theme)

  return (
    <TouchableOpacity
      style={styles.row}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      testID={testID}
    >
      {!!icon && <BootstrapIcon name={icon} size={IconSizes.medium} color={theme.ColorPalette.brand.primary} />}
      <View style={styles.texts}>
        <Text style={styles.label}>{label}</Text>
        {!!paragraph && <Text style={styles.paragraph}>{paragraph}</Text>}
      </View>
      {right}
    </TouchableOpacity>
  )
}
