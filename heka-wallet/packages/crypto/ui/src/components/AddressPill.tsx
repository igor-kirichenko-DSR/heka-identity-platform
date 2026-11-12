import { testIdWithKey } from '@bifold/core'
import { IconSizes, type HekaTheme, IconButton, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'

import { useCopyAddress } from '../hooks/useCopyAddress'
import { shortAddress } from '../utils/format'

const useStyles = ({ Spacing, BorderRadius, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    pill: {
      alignSelf: 'center',
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.big,
      backgroundColor: ColorPalette.brand.primary,
    },
    text: { color: ColorPalette.grayscale.white },
  })

interface Props {
  address: string
}

/** The short address as a filled pill; tapping it copies the address and the icon turns into a check for a moment. */
export const AddressPill: React.FC<Props> = ({ address }) => {
  const theme = useHekaTheme()
  const styles = useStyles(theme)
  const { t } = useTranslation()
  const { copied, copy } = useCopyAddress(address)

  return (
    <IconButton
      iconName={copied ? 'clipboard-check' : 'clipboard'}
      iconSize={IconSizes.small}
      iconColor={theme.ColorPalette.grayscale.white}
      label={copied ? t('Crypto.Address.Copied') : shortAddress(address)}
      textStyle={styles.text}
      containerStyle={styles.pill}
      accessibilityLabel={t('Crypto.Address.Copy')}
      onPress={copy}
      testId={testIdWithKey('CryptoCopyAddress')}
    />
  )
}
