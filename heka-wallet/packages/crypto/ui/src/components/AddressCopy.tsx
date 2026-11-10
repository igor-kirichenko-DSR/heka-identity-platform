import { testIdWithKey } from '@bifold/core'
import { IconSizes, type HekaTheme, IconButton, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { useCopyAddress } from '../hooks/useCopyAddress'

const useStyles = ({ Spacing, BorderRadius, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.xs,
      paddingLeft: Spacing.md,
      borderRadius: BorderRadius.big,
      backgroundColor: ColorPalette.brand.primary,
    },
    address: { ...TextTheme.normal, color: ColorPalette.grayscale.white, flexShrink: 1, textAlign: 'center' },
    copied: { color: ColorPalette.grayscale.white },
  })

interface Props {
  address: string
}

/** The whole address, wrapped, in a filled pill with a copy button (Receive). Home uses the short AddressPill. */
export const AddressCopy: React.FC<Props> = ({ address }) => {
  const theme = useHekaTheme()
  const styles = useStyles(theme)
  const { t } = useTranslation()
  const { copied, copy } = useCopyAddress(address)

  return (
    <View style={styles.pill}>
      <Text style={styles.address} selectable testID={testIdWithKey('CryptoAddress')}>
        {address}
      </Text>
      <IconButton
        iconName={copied ? 'clipboard-check' : 'clipboard'}
        iconSize={IconSizes.small}
        iconColor={theme.ColorPalette.grayscale.white}
        label={copied ? t('Crypto.Address.Copied') : undefined}
        textStyle={styles.copied}
        accessibilityLabel={t('Crypto.Address.Copy')}
        onPress={copy}
        testId={testIdWithKey('CryptoCopyAddress')}
      />
    </View>
  )
}
