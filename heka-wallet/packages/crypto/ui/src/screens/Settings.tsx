import type { CryptoMainStackParams } from '../navigators/types'
import type { StackScreenProps } from '@react-navigation/stack'

import { Button, ButtonType, testIdWithKey } from '@bifold/core'
import { type HekaTheme, useGlobalStyles, useHekaTheme } from '@heka-wallet/shared'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { ChainSwitcher } from '../components/ChainSwitcher'
import { useSettings } from '../hooks/useSettings'
import { CryptoScreens } from '../navigators/routes'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    section: { ...TextTheme.headingFour, paddingTop: Spacing.lg, paddingBottom: Spacing.xs },
    error: { ...TextTheme.normal, color: ColorPalette.semantic.error },
    buttons: { gap: Spacing.md, paddingVertical: Spacing.lg },
  })

type Props = StackScreenProps<CryptoMainStackParams, CryptoScreens.Settings>

export const Settings: React.FC<Props> = observer(({ navigation }) => {
  const styles = useStyles(useHekaTheme())
  const globalStyles = useGlobalStyles()
  const { t } = useTranslation()
  const settings = useSettings()

  return (
    <ScrollView contentContainerStyle={globalStyles.defaultContainer}>
      {settings.chains.length > 1 && <Text style={styles.section}>{t('Crypto.Settings.DefaultChain')}</Text>}
      <ChainSwitcher
        chains={settings.chains}
        currentId={settings.defaultChainId}
        onSelect={(chainId) => void settings.setDefaultChain(chainId)}
      />
      {settings.saveFailed && <Text style={styles.error}>{t('Crypto.Settings.SaveFailed')}</Text>}
      <View style={styles.buttons}>
        {settings.canReveal && (
          <Button
            title={t('Crypto.Settings.RevealPhrase')}
            buttonType={ButtonType.Secondary}
            onPress={() => navigation.navigate(CryptoScreens.RevealPhrase)}
            testID={testIdWithKey('CryptoRevealPhrase')}
          />
        )}
        <Button
          title={t('Crypto.Settings.RemoveWallet')}
          buttonType={ButtonType.Critical}
          onPress={() => navigation.navigate(CryptoScreens.RemoveWallet)}
          testID={testIdWithKey('CryptoRemoveWallet')}
        />
      </View>
    </ScrollView>
  )
})
