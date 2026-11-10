import type { CryptoRegisterStackParams } from '../../navigators/types'
import type { StackScreenProps } from '@react-navigation/stack'

import { Button, ButtonType, testIdWithKey } from '@bifold/core'
import { type HekaTheme, ScreenInfoText, useGlobalStyles, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'

import { CryptoScreens } from '../../navigators/routes'

const useStyles = ({ Spacing }: HekaTheme) =>
  StyleSheet.create({
    buttons: { flex: 1, justifyContent: 'flex-end', gap: Spacing.md, paddingBottom: Spacing.md },
  })

type Props = StackScreenProps<CryptoRegisterStackParams, CryptoScreens.RegisterIntro>

export const RegisterIntro: React.FC<Props> = ({ navigation }) => {
  const styles = useStyles(useHekaTheme())
  const globalStyles = useGlobalStyles()
  const { t } = useTranslation()

  return (
    <View style={globalStyles.defaultContainer}>
      <ScreenInfoText title={t('Crypto.Register.Intro.Title')} textLines={[t('Crypto.Register.Intro.Text')]} />
      <View style={styles.buttons}>
        <Button
          title={t('Crypto.Register.Intro.Create')}
          buttonType={ButtonType.Primary}
          onPress={() => navigation.navigate(CryptoScreens.NewMnemonic)}
          testID={testIdWithKey('CryptoCreateWallet')}
        />
        <Button
          title={t('Crypto.Register.Intro.Import')}
          buttonType={ButtonType.Secondary}
          onPress={() => navigation.navigate(CryptoScreens.ImportWallet)}
          testID={testIdWithKey('CryptoImportWallet')}
        />
      </View>
    </View>
  )
}
