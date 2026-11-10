import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

const useStyles = ({ Spacing, BorderRadius, ColorPalette, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    banner: {
      padding: Spacing.md,
      marginVertical: Spacing.xs,
      borderRadius: BorderRadius.small,
      backgroundColor: ColorPalette.notification.warn,
    },
    text: { ...TextTheme.normal, color: ColorPalette.notification.warnText },
  })

/** Hedera: the account exists on-ledger only after its first deposit. */
export const ActivationBanner: React.FC = () => {
  const styles = useStyles(useHekaTheme())
  const { t } = useTranslation()

  return (
    <View style={styles.banner} testID={testIdWithKey('CryptoActivationBanner')}>
      <Text style={styles.text}>{t('Crypto.Home.ActivationPending')}</Text>
    </View>
  )
}
