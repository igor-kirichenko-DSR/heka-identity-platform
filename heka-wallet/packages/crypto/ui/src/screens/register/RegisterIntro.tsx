import type { CryptoRegisterStackParams } from '../../navigators/types'
import type { StackScreenProps } from '@react-navigation/stack'

import { Button, ButtonType, testIdWithKey } from '@bifold/core'
import { type HekaTheme, IconButton, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { RegisterIllustration } from '../../components/RegisterIllustration'
import { useRegisterFlow } from '../../navigators/RegisterFlowContext'
import { CryptoScreens } from '../../navigators/routes'

const useStyles = ({ Spacing, BorderRadius, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    screen: { flex: 1, padding: Spacing.md },
    card: {
      flex: 1,
      padding: Spacing.md,
      gap: Spacing.sm,
      borderRadius: BorderRadius.bigger,
      backgroundColor: ColorPalette.grayscale.white,
    },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    emptyText: { ...TextTheme.normal, color: ColorPalette.grayscale.mediumGrey },
    importLabel: { color: ColorPalette.grayscale.black },
  })

type Props = StackScreenProps<CryptoRegisterStackParams, CryptoScreens.RegisterIntro>

/** No wallet yet: the empty Coins card with the two ways in. */
export const RegisterIntro: React.FC<Props> = ({ navigation }) => {
  const styles = useStyles(useHekaTheme())
  const { t } = useTranslation()
  const { setKind } = useRegisterFlow()

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.empty}>
          <RegisterIllustration />
          <Text style={styles.emptyText}>{t('Crypto.Register.Intro.Empty')}</Text>
        </View>
        <IconButton
          iconName="upload"
          label={t('Crypto.Register.Intro.Import')}
          textStyle={styles.importLabel}
          onPress={() => {
            setKind('import')
            navigation.navigate(CryptoScreens.ImportWallet)
          }}
          testId={testIdWithKey('CryptoImportWallet')}
        />
        <Button
          title={t('Crypto.Register.Intro.Create')}
          accessibilityLabel={t('Crypto.Register.Intro.Create')}
          buttonType={ButtonType.Secondary}
          onPress={() => {
            setKind('create')
            navigation.navigate(CryptoScreens.NewMnemonic)
          }}
          testID={testIdWithKey('CryptoCreateWallet')}
        />
      </View>
    </View>
  )
}
