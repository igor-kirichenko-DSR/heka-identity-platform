import type { CryptoMainStackParams } from '../navigators/types'
import type { StackScreenProps } from '@react-navigation/stack'

import { ButtonType, testIdWithKey } from '@bifold/core'
import { type HekaTheme, Loader, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text } from 'react-native'

import { AuthGate } from '../components/AuthGate'
import { type BottomAction, BottomActions } from '../components/BottomActions'
import { SignContent } from '../components/SignContent'
import { SignSummary } from '../components/SignSummary'
import { useScrollContent } from '../hooks/useScrollContent'
import { useSignRequest } from '../hooks/useSignRequest'
import { CryptoScreens } from '../navigators/routes'
import { useCrypto } from '../provider/CryptoContext'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    message: { ...TextTheme.normal, paddingVertical: Spacing.sm },
    error: { ...TextTheme.normal, color: ColorPalette.semantic.error, paddingVertical: Spacing.sm },
  })

type Props = StackScreenProps<CryptoMainStackParams, CryptoScreens.SignRequest>

/** A relying party asks for a signature: the holder reads who, where and what, then signs with a fresh PIN or rejects. */
export const SignRequest: React.FC<Props> = ({ navigation, route }) => {
  const styles = useStyles(useHekaTheme())
  const scrollContent = useScrollContent()
  const { t } = useTranslation()
  const { registry } = useCrypto()
  const { state, sign, gateProps } = useSignRequest(route.params.requestUrl)
  const leave = () => navigation.goBack()

  if (state.status === 'loading') return <Loader testID={testIdWithKey('CryptoSignLoading')} />
  if (state.status === 'refused') {
    return (
      <ScrollView contentContainerStyle={scrollContent}>
        <Text style={styles.error} testID={testIdWithKey('CryptoSignRefused')}>
          {t(`Crypto.Sign.Refused.${state.code}`)}
        </Text>
        <BottomActions
          actions={[{ title: t('Crypto.Sign.Back'), onPress: leave, testID: testIdWithKey('CryptoSignBack') }]}
        />
      </ScrollView>
    )
  }

  const { fetched, address } = state
  const busy = state.status === 'signing' || state.status === 'sending'
  const done = state.status === 'done'
  const actions: BottomAction[] = done
    ? [{ title: t('Crypto.Sign.Done'), onPress: leave, testID: testIdWithKey('CryptoSignDone') }]
    : [
        {
          title: state.status === 'send-failed' ? t('Crypto.Sign.Retry') : t('Crypto.Sign.Submit'),
          onPress: () => void sign(),
          isLoading: busy,
          testID: testIdWithKey('CryptoSignConfirm'),
        },
        {
          title: t('Crypto.Sign.Reject'),
          type: ButtonType.Secondary,
          onPress: leave,
          disabled: busy,
          testID: testIdWithKey('CryptoSignReject'),
        },
      ]

  return (
    <ScrollView contentContainerStyle={scrollContent}>
      <SignSummary
        origin={fetched.origin}
        chainName={registry.get(fetched.request.chain).chain.name}
        address={address}
        branch={fetched.request.branch}
      />
      <SignContent request={fetched.request} />
      {done && <Text style={styles.message}>{t('Crypto.Sign.Sent')}</Text>}
      {state.status === 'send-failed' && <Text style={styles.error}>{t('Crypto.Sign.SendFailed')}</Text>}
      {state.status === 'sign-failed' && <Text style={styles.error}>{t('Crypto.Sign.SignFailed')}</Text>}
      <BottomActions actions={actions} />
      <AuthGate {...gateProps} />
    </ScrollView>
  )
}
