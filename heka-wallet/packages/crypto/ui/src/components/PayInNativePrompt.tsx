import { ButtonType, testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { BottomActions } from './BottomActions'

const useStyles = ({ Spacing, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    container: { gap: Spacing.sm, paddingVertical: Spacing.sm },
    text: { ...TextTheme.normal },
  })

interface Props {
  /** The chain's native asset, which pays the fee if the holder agrees. */
  symbol: string
  onAccept: () => void
  onDismiss: () => void
}

/** Shown when USDC fees failed before anything was sent; nothing is sent until the holder picks an answer. */
export const PayInNativePrompt: React.FC<Props> = ({ symbol, onAccept, onDismiss }) => {
  const styles = useStyles(useHekaTheme())
  const { t } = useTranslation()

  return (
    <View style={styles.container} testID={testIdWithKey('CryptoPayInNative')}>
      <Text style={styles.text}>{t('Crypto.Fee.PayInNativeTitle', { symbol })}</Text>
      <BottomActions
        actions={[
          {
            title: t('Crypto.Fee.PayInNativeAction', { symbol }),
            onPress: onAccept,
            testID: testIdWithKey('CryptoPayInNativeAccept'),
          },
          {
            title: t('Crypto.Fee.PayInNativeDismiss'),
            onPress: onDismiss,
            type: ButtonType.Secondary,
            testID: testIdWithKey('CryptoPayInNativeDismiss'),
          },
        ]}
      />
    </View>
  )
}
