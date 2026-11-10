import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, IconButton, TextInput, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { ADDRESS_ACCESSORY_WIDTH } from '../constants'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    field: { justifyContent: 'center' },
    scan: { position: 'absolute', right: 0, top: Spacing.md },
    inputText: { paddingRight: ADDRESS_ACCESSORY_WIDTH },
    warning: { ...TextTheme.caption, color: ColorPalette.notification.warnText, marginBottom: Spacing.xs },
  })

interface Props {
  value: string
  onChange: (value: string) => void
  onScan: () => void
  invalid: boolean
  /** A code from the adapter's validation, e.g. a lower-case address without checksum. */
  warning?: string
  isNewRecipient: boolean
}

/** The recipient input with the QR scan icon inside it, at the right. */
export const AddressField: React.FC<Props> = ({ value, onChange, onScan, invalid, warning, isNewRecipient }) => {
  const styles = useStyles(useHekaTheme())
  const { t } = useTranslation()

  return (
    <View>
      <View style={styles.field}>
        <TextInput
          label={t('Crypto.Send.Recipient')}
          value={value}
          onChangeText={onChange}
          error={invalid ? t('Crypto.Send.Errors.InvalidAddress') : undefined}
          contentStyle={styles.inputText}
          autoCapitalize="none"
          autoCorrect={false}
          testID={testIdWithKey('CryptoRecipient')}
        />
        <View style={styles.scan}>
          <IconButton
            iconName="qr-code-scan"
            accessibilityLabel={t('Crypto.Send.Scan')}
            onPress={onScan}
            testId={testIdWithKey('CryptoScanRecipient')}
          />
        </View>
      </View>
      {!!warning && <Text style={styles.warning}>{t(`Crypto.Send.AddressWarnings.${warning}`)}</Text>}
      {isNewRecipient && <Text style={styles.warning}>{t('Crypto.Send.NewRecipient')}</Text>}
    </View>
  )
}
