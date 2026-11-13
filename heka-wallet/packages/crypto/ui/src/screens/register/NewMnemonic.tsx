import type { CryptoRegisterStackParams } from '../../navigators/types'
import type { StackScreenProps } from '@react-navigation/stack'

import { testIdWithKey, usePreventScreenCapture } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'

import { InfoLines } from '../../components/InfoLines'
import { RegisterFooter } from '../../components/RegisterFooter'
import { WordsCard } from '../../components/WordsCard'
import { useDebugCopyPhrase } from '../../hooks/useDebugCopyPhrase'
import { useHideOnBackground } from '../../hooks/useHideOnBackground'
import { useHideOnBlur } from '../../hooks/useHideOnBlur'
import { useNewMnemonic } from '../../hooks/useNewMnemonic'
import { useScrollContent } from '../../hooks/useScrollContent'
import { CryptoScreens } from '../../navigators/routes'

const useStyles = ({ TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    debug: { ...TextTheme.caption, color: ColorPalette.notification.warnText, textAlign: 'center' },
  })

type Props = StackScreenProps<CryptoRegisterStackParams, CryptoScreens.NewMnemonic>

/**
 * Shown once; no copy button, screen capture blocked, words blanked in the background and when the screen loses focus.
 * Debug builds only: tapping the text and words quickly copies the phrase (test aid, see useDebugCopyPhrase).
 */
export const NewMnemonic: React.FC<Props> = ({ navigation }) => {
  usePreventScreenCapture()
  const styles = useStyles(useHekaTheme())
  const scrollContent = useScrollContent()
  const { t } = useTranslation()
  const words = useNewMnemonic()
  const hiddenInBackground = useHideOnBackground()
  const hiddenOnBlur = useHideOnBlur()
  const debugCopy = useDebugCopyPhrase(words)

  return (
    <ScrollView contentContainerStyle={scrollContent}>
      <Pressable onPress={debugCopy.onTap} disabled={!debugCopy.onTap} testID={testIdWithKey('CryptoPhraseDebugCopy')}>
        <InfoLines lines={[t('Crypto.Register.NewMnemonic.Text1'), t('Crypto.Register.NewMnemonic.Text2')]} />
        <WordsCard
          words={words.map((value) => ({ value }))}
          hidden={hiddenInBackground || hiddenOnBlur}
          testKey="CryptoPhraseWord"
        />
      </Pressable>
      {debugCopy.copied && <Text style={styles.debug}>{t('Crypto.Debug.PhraseCopied')}</Text>}
      <RegisterFooter
        screen={CryptoScreens.NewMnemonic}
        actions={[
          {
            title: t('Crypto.Register.NewMnemonic.Written'),
            onPress: () => navigation.navigate(CryptoScreens.VerifyMnemonic),
            testID: testIdWithKey('CryptoPhraseWritten'),
          },
        ]}
      />
    </ScrollView>
  )
}
