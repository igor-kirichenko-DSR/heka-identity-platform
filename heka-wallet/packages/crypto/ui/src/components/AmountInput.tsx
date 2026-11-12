import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, TextInput, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { AMOUNT_ACCESSORY_WIDTH } from '../constants'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    field: { justifyContent: 'center' },
    accessory: {
      position: 'absolute',
      right: Spacing.md,
      top: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    inputText: { paddingRight: AMOUNT_ACCESSORY_WIDTH },
    max: { ...TextTheme.bold, color: ColorPalette.brand.highlight },
    symbol: { ...TextTheme.normal },
  })

interface Props {
  value: string
  symbol: string
  onChange: (value: string) => void
  onMax: () => void
  invalid: boolean
}

/** Text in, bigint out (the form parses it with the asset's decimals); no number conversion here. */
export const AmountInput: React.FC<Props> = ({ value, symbol, onChange, onMax, invalid }) => {
  const styles = useStyles(useHekaTheme())
  const { t } = useTranslation()

  return (
    <View style={styles.field}>
      <TextInput
        label={t('Crypto.Send.Amount', { symbol })}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        error={invalid ? t('Crypto.Send.Errors.InvalidAmount') : undefined}
        contentStyle={styles.inputText}
        testID={testIdWithKey('CryptoAmount')}
      />
      <View style={styles.accessory}>
        <TouchableOpacity onPress={onMax} accessibilityRole="button" testID={testIdWithKey('CryptoAmountMax')}>
          <Text style={styles.max}>{t('Crypto.Send.Max')}</Text>
        </TouchableOpacity>
        <Text style={styles.symbol}>{symbol}</Text>
      </View>
    </View>
  )
}
