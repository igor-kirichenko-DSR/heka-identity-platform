import type { FeeQuote } from '@heka-wallet/crypto-core'

import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { formatAmount } from '../utils/format'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    container: { paddingVertical: Spacing.sm },
    text: { ...TextTheme.normal },
    warning: { ...TextTheme.caption, color: ColorPalette.notification.warnText },
  })

interface Props {
  quote?: FeeQuote
  isQuoting: boolean
  failed: boolean
}

/** "Fee: 0.00002 ETH", or "up to N USDC" in paymaster mode, where the permit ceiling is what can be charged. */
export const FeePreview: React.FC<Props> = ({ quote, isQuoting, failed }) => {
  const styles = useStyles(useHekaTheme())
  const { t } = useTranslation()

  if (isQuoting) return <ActivityIndicator style={styles.container} testID={testIdWithKey('CryptoFeeLoading')} />
  if (failed) return <Text style={[styles.container, styles.warning]}>{t('Crypto.Fee.Failed')}</Text>
  if (!quote) return null
  const fee =
    quote.max === undefined
      ? t('Crypto.Fee.Estimate', { amount: formatAmount(quote.amount, quote.asset) })
      : t('Crypto.Fee.UpTo', { amount: formatAmount(quote.max, quote.asset) })

  return (
    <View style={styles.container} testID={testIdWithKey('CryptoFeePreview')}>
      <Text style={styles.text}>{fee}</Text>
      {quote.warnings?.map((warning) => (
        <Text key={warning} style={styles.warning}>
          {t(`Crypto.Fee.Warnings.${warning}`)}
        </Text>
      ))}
    </View>
  )
}
