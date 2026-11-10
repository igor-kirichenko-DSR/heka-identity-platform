import type { CryptoRegisterStackParams } from '../../navigators/types'
import type { StackScreenProps } from '@react-navigation/stack'

import { Button, ButtonType, testIdWithKey, usePreventScreenCapture } from '@bifold/core'
import { type HekaTheme, ScreenInfoText, useGlobalStyles, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, View } from 'react-native'

import { WordsCard } from '../../components/WordsCard'
import { useHideOnBackground } from '../../hooks/useHideOnBackground'
import { useNewMnemonic } from '../../hooks/useNewMnemonic'
import { CryptoScreens } from '../../navigators/routes'

const useStyles = ({ Spacing }: HekaTheme) =>
  StyleSheet.create({
    button: { paddingVertical: Spacing.md },
  })

type Props = StackScreenProps<CryptoRegisterStackParams, CryptoScreens.NewMnemonic>

/** Shown once; no copy button, screen capture blocked, words blanked in the background. */
export const NewMnemonic: React.FC<Props> = ({ navigation }) => {
  usePreventScreenCapture()
  const styles = useStyles(useHekaTheme())
  const globalStyles = useGlobalStyles()
  const { t } = useTranslation()
  const words = useNewMnemonic()
  const hidden = useHideOnBackground()

  return (
    <ScrollView contentContainerStyle={globalStyles.defaultContainer}>
      <ScreenInfoText
        title={t('Crypto.Register.NewMnemonic.Title')}
        textLines={[t('Crypto.Register.NewMnemonic.Text1'), t('Crypto.Register.NewMnemonic.Text2')]}
      />
      <WordsCard words={words.map((value) => ({ value }))} hidden={hidden} testKey="CryptoPhraseWord" />
      <View style={styles.button}>
        <Button
          title={t('Crypto.Register.NewMnemonic.Written')}
          buttonType={ButtonType.Primary}
          onPress={() => navigation.navigate(CryptoScreens.VerifyMnemonic)}
          testID={testIdWithKey('CryptoPhraseWritten')}
        />
      </View>
    </ScrollView>
  )
}
