import type { SendForm as SendFormState } from '../hooks/useSendForm'

import { Button, ButtonType, testIdWithKey } from '@bifold/core'
import { type HekaTheme, useGlobalStyles, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { AddressField } from './AddressField'
import { AmountInput } from './AmountInput'
import { AssetPicker } from './AssetPicker'
import { FeeModePicker } from './FeeModePicker'
import { FeePreview } from './FeePreview'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    content: { paddingTop: Spacing.md },
    error: { ...TextTheme.normal, color: ColorPalette.semantic.error, paddingVertical: Spacing.xs },
    button: { paddingVertical: Spacing.md },
  })

const FUNDS_ERRORS = {
  'insufficient-amount': 'Crypto.Send.Errors.InsufficientAmount',
  'insufficient-fee': 'Crypto.Send.Errors.InsufficientFee',
}

interface Props {
  form: SendFormState
  onScan: () => void
  onSend: () => void
  isSending: boolean
  submitError?: string
}

export const SendForm: React.FC<Props> = ({ form, onScan, onSend, isSending, submitError }) => {
  const styles = useStyles(useHekaTheme())
  const globalStyles = useGlobalStyles()
  const { t } = useTranslation()
  const fundsError = form.funds && form.funds !== 'ok' ? FUNDS_ERRORS[form.funds] : undefined
  const errors = [fundsError, form.hasPendingSend ? 'Crypto.Send.Errors.Pending' : undefined, submitError]

  return (
    <ScrollView
      contentContainerStyle={[globalStyles.defaultContainer, styles.content]}
      keyboardShouldPersistTaps="handled"
    >
      <AssetPicker assets={form.assets} selectedId={form.asset?.id} onSelect={form.selectAsset} />
      <AddressField
        value={form.to}
        onChange={form.setTo}
        onScan={onScan}
        invalid={form.addressInvalid}
        warning={form.addressWarning}
        isNewRecipient={form.isNewRecipient}
      />
      <AmountInput
        value={form.amountText}
        symbol={form.asset?.symbol ?? ''}
        onChange={form.setAmountText}
        onMax={form.setMax}
        invalid={form.amountInvalid}
      />
      <FeeModePicker
        modes={form.feeModes}
        selected={form.feeMode}
        nativeSymbol={form.chain?.nativeAsset.symbol ?? ''}
        onSelect={form.setFeeMode}
      />
      <FeePreview quote={form.quote} isQuoting={form.isQuoting} failed={form.quoteFailed} />
      {errors.map(
        (key) =>
          key && (
            <Text key={key} style={styles.error}>
              {t(key)}
            </Text>
          )
      )}
      <View style={styles.button}>
        <Button
          title={t('Global.Send')}
          buttonType={ButtonType.Primary}
          disabled={!form.canSend || isSending}
          onPress={onSend}
          testID={testIdWithKey('CryptoSendSubmit')}
        />
      </View>
    </ScrollView>
  )
}
