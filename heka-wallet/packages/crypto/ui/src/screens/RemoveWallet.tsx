import type { CryptoMainStackParams } from '../navigators/types'
import type { StackScreenProps } from '@react-navigation/stack'

import { ButtonType, testIdWithKey } from '@bifold/core'
import { type HekaTheme, ScreenInfoText, useHekaTheme } from '@heka-wallet/shared'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text } from 'react-native'

import { AssetBalanceBlocks } from '../components/AssetBalanceBlocks'
import { AuthGate } from '../components/AuthGate'
import { BottomActions } from '../components/BottomActions'
import { useHome } from '../hooks/useHome'
import { useRemoveWallet } from '../hooks/useRemoveWallet'
import { useScrollContent } from '../hooks/useScrollContent'
import { CryptoScreens } from '../navigators/routes'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    error: { ...TextTheme.normal, color: ColorPalette.semantic.error, paddingVertical: Spacing.sm },
  })

type Props = StackScreenProps<CryptoMainStackParams, CryptoScreens.RemoveWallet>

/** Shows what is at stake (the balances) and that only the phrase can bring the funds back. */
export const RemoveWallet: React.FC<Props> = observer(({ navigation }) => {
  const styles = useStyles(useHekaTheme())
  const scrollContent = useScrollContent()
  const { t } = useTranslation()
  const { rows } = useHome()
  const { remove, isRemoving, failed, gateProps } = useRemoveWallet()

  return (
    <ScrollView contentContainerStyle={scrollContent}>
      <ScreenInfoText title={t('Crypto.Remove.Title')} textLines={[t('Crypto.Remove.Warning')]} />
      <AssetBalanceBlocks rows={rows} />
      {failed && <Text style={styles.error}>{t('Crypto.Remove.Failed')}</Text>}
      <BottomActions
        actions={[
          {
            title: t('Crypto.Remove.Submit'),
            type: ButtonType.Critical,
            disabled: isRemoving,
            onPress: () => void remove(),
            testID: testIdWithKey('CryptoRemoveConfirm'),
          },
          {
            title: t('Global.Cancel'),
            type: ButtonType.Secondary,
            onPress: () => navigation.goBack(),
            testID: testIdWithKey('CryptoRemoveCancel'),
          },
        ]}
      />
      <AuthGate {...gateProps} />
    </ScrollView>
  )
})
