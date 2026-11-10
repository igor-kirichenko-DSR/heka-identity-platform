import { ScanCamera, testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { useScanAddress } from '../hooks/useScanAddress'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    error: {
      ...TextTheme.normal,
      color: ColorPalette.grayscale.white,
      backgroundColor: ColorPalette.semantic.error,
      padding: Spacing.md,
    },
  })

/** Camera for a recipient: an EIP-681 payment request or a plain address. */
export const ScanAddress: React.FC = () => {
  const styles = useStyles(useHekaTheme())
  const { t } = useTranslation()
  const { handleCodeScan, error } = useScanAddress()

  return (
    <View style={styles.container}>
      <ScanCamera handleCodeScan={handleCodeScan} enableCameraOnError />
      {!!error && (
        <Text style={styles.error} testID={testIdWithKey('CryptoScanError')}>
          {t(error)}
        </Text>
      )}
    </View>
  )
}
