import { Button, ButtonType, testIdWithKey } from '@bifold/core'
import { type HekaTheme, useGlobalStyles, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

const useStyles = ({ Spacing, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    message: { ...TextTheme.normal, textAlign: 'center', marginBottom: Spacing.xl },
  })

interface Props {
  failed: boolean
  onRetry: () => void
}

/** Shown until the wallet status is known: a spinner, or the failure with a retry. */
export const WalletStatusView: React.FC<Props> = ({ failed, onRetry }) => {
  const styles = useStyles(useHekaTheme())
  const globalStyles = useGlobalStyles()
  const { t } = useTranslation()

  return (
    <View style={globalStyles.centeredView}>
      {failed ? (
        <>
          <Text style={styles.message}>{t('Crypto.Wallet.LoadFailed')}</Text>
          <Button
            title={t('Crypto.Wallet.Retry')}
            buttonType={ButtonType.Primary}
            onPress={onRetry}
            testID={testIdWithKey('CryptoRetryLoad')}
          />
        </>
      ) : (
        <ActivityIndicator testID={testIdWithKey('CryptoLoading')} />
      )}
    </View>
  )
}
