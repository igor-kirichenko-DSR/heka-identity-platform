import type { CryptoMainStackParams } from '../navigators/types'
import type { StackScreenProps } from '@react-navigation/stack'

import { Button, ButtonType, testIdWithKey } from '@bifold/core'
import { type HekaTheme, ScreenInfoText, useGlobalStyles, useHekaTheme } from '@heka-wallet/shared'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { AuthGate } from '../components/AuthGate'
import { BalanceRow } from '../components/BalanceRow'
import { useHome } from '../hooks/useHome'
import { useRemoveWallet } from '../hooks/useRemoveWallet'
import { CryptoScreens } from '../navigators/routes'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    error: { ...TextTheme.normal, color: ColorPalette.semantic.error, paddingVertical: Spacing.sm },
    buttons: { gap: Spacing.md, paddingVertical: Spacing.lg },
  })

type Props = StackScreenProps<CryptoMainStackParams, CryptoScreens.RemoveWallet>

/** Shows what is at stake (the balances) and that only the phrase can bring the funds back. */
export const RemoveWallet: React.FC<Props> = observer(({ navigation }) => {
  const styles = useStyles(useHekaTheme())
  const globalStyles = useGlobalStyles()
  const { t } = useTranslation()
  const { rows } = useHome()
  const { remove, isRemoving, failed, gateProps } = useRemoveWallet()

  return (
    <ScrollView contentContainerStyle={globalStyles.defaultContainer}>
      <ScreenInfoText title={t('Crypto.Remove.Title')} textLines={[t('Crypto.Remove.Warning')]} />
      {rows.map(({ asset, balance }) => (
        <BalanceRow key={asset.id} asset={asset} balance={balance} />
      ))}
      {failed && <Text style={styles.error}>{t('Crypto.Remove.Failed')}</Text>}
      <View style={styles.buttons}>
        <Button
          title={t('Crypto.Remove.Submit')}
          buttonType={ButtonType.Critical}
          disabled={isRemoving}
          onPress={() => void remove()}
          testID={testIdWithKey('CryptoRemoveConfirm')}
        />
        <Button
          title={t('Global.Cancel')}
          buttonType={ButtonType.Secondary}
          onPress={() => navigation.goBack()}
          testID={testIdWithKey('CryptoRemoveCancel')}
        />
      </View>
      <AuthGate {...gateProps} />
    </ScrollView>
  )
})
