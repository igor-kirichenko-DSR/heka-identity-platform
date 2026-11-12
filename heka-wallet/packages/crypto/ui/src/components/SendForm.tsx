import type { SendForm as SendFormState } from '../hooks/useSendForm'

import { KeyboardView, testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text } from 'react-native'

import { useScrollContent } from '../hooks/useScrollContent'

import { AddressField } from './AddressField'
import { AmountInput } from './AmountInput'
import { AssetPicker } from './AssetPicker'
import { BottomActions } from './BottomActions'
import { Card } from './Card'
import { FeeModePicker } from './FeeModePicker'
import { FeePreview } from './FeePreview'
import { SendBalanceCard } from './SendBalanceCard'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    content: { paddingTop: Spacing.md, gap: Spacing.sm },
    error: { ...TextTheme.caption, color: ColorPalette.semantic.error },
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
  const scrollContent = useScrollContent()
  const { t } = useTranslation()
  const fundsError = form.funds && form.funds !== 'ok' ? FUNDS_ERRORS[form.funds] : undefined
  const symbol = form.asset?.symbol ?? ''
  const title =
    form.amountText && !form.amountInvalid
      ? t('Crypto.Send.SubmitAmount', { amount: form.amountText, symbol })
      : t('Global.Send')
  const errors = [fundsError, form.hasPendingSend ? 'Crypto.Send.Errors.Pending' : undefined, submitError]

  return (
    <KeyboardView scrollViewProps={{ contentContainerStyle: [scrollContent, styles.content] }}>
      <SendBalanceCard />
      <Card>
        {form.assets.length > 1 && (
          <AssetPicker assets={form.assets} selectedId={form.asset?.id} onSelect={form.selectAsset} />
        )}
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
          symbol={symbol}
          onChange={form.setAmountText}
          onMax={form.setMax}
          invalid={form.amountInvalid}
        />
        <FeeModePicker
          modes={form.feeModes}
          selected={form.feeMode}
          nativeSymbol={form.chain?.nativeAsset.symbol ?? ''}
          quote={form.quote}
          onSelect={form.setFeeMode}
        />
        <FeePreview
          quote={form.quote}
          isQuoting={form.isQuoting}
          failed={form.quoteFailed}
          showAmount={form.feeModes.length < 2}
        />
        {errors.map(
          (key) =>
            key && (
              <Text key={key} style={styles.error}>
                {t(key)}
              </Text>
            )
        )}
        <BottomActions
          actions={[
            {
              title,
              onPress: onSend,
              disabled: !form.canSend,
              isLoading: isSending,
              testID: testIdWithKey('CryptoSendSubmit'),
            },
          ]}
        />
      </Card>
    </KeyboardView>
  )
}
