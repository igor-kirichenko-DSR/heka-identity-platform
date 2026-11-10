import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, TextInput, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start' },
    input: { flex: 1 },
    max: { padding: Spacing.md },
    maxText: { ...TextTheme.bold, color: ColorPalette.brand.highlight },
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
    <View style={styles.row}>
      <View style={styles.input}>
        <TextInput
          label={t('Crypto.Send.Amount', { symbol })}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          error={invalid ? t('Crypto.Send.Errors.InvalidAmount') : undefined}
          testID={testIdWithKey('CryptoAmount')}
        />
      </View>
      <TouchableOpacity
        style={styles.max}
        onPress={onMax}
        accessibilityRole="button"
        testID={testIdWithKey('CryptoAmountMax')}
      >
        <Text style={styles.maxText}>{t('Crypto.Send.Max')}</Text>
      </TouchableOpacity>
    </View>
  )
}
