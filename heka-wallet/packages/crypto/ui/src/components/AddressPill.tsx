import { testIdWithKey } from '@bifold/core'
import { BootstrapIcon, IconSizes, type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'

import { useCopyAddress } from '../hooks/useCopyAddress'

const useStyles = ({ Spacing, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    text: { ...TextTheme.normal, flexShrink: 1 },
  })

interface Props {
  address: string
}

/** The whole address as plain wrapped text; tapping copies it and the icon turns into a check for a moment. */
export const AddressPill: React.FC<Props> = ({ address }) => {
  const theme = useHekaTheme()
  const styles = useStyles(theme)
  const { t } = useTranslation()
  const { copied, copy } = useCopyAddress(address)

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={copy}
      accessibilityRole="button"
      accessibilityLabel={t('Crypto.Address.Copy')}
      testID={testIdWithKey('CryptoCopyAddress')}
    >
      <Text style={styles.text}>{copied ? t('Crypto.Address.Copied') : address}</Text>
      <BootstrapIcon
        name={copied ? 'clipboard-check' : 'clipboard'}
        size={IconSizes.small}
        color={theme.ColorPalette.brand.icon}
      />
    </TouchableOpacity>
  )
}
