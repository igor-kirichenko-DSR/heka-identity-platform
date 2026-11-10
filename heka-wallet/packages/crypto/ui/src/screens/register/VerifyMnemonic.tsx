import { Button, ButtonType, testIdWithKey, usePreventScreenCapture } from '@bifold/core'
import { type HekaTheme, ScreenInfoText, useGlobalStyles, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { CandidateWords } from '../../components/CandidateWords'
import { WordsCard } from '../../components/WordsCard'
import { useHideOnBackground } from '../../hooks/useHideOnBackground'
import { useVerifyPhrase } from '../../hooks/useVerifyPhrase'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    words: { marginTop: Spacing.xl },
    error: { ...TextTheme.normal, color: ColorPalette.semantic.error, marginTop: Spacing.md },
    buttons: { paddingVertical: Spacing.md, gap: Spacing.md },
  })

interface Props {
  phrase: string
}

/** The phrase is stored only here, after the holder has put the missing words back in order. */
export const VerifyMnemonic: React.FC<Props> = ({ phrase }) => {
  usePreventScreenCapture()
  const styles = useStyles(useHekaTheme())
  const globalStyles = useGlobalStyles()
  const { t } = useTranslation()
  const { slots, candidates, toggle, reset, isComplete, isCorrect, store, isSaving, error } = useVerifyPhrase(phrase)
  const hidden = useHideOnBackground()
  const wrongOrder = isComplete && !isCorrect

  return (
    <ScrollView contentContainerStyle={globalStyles.defaultContainer}>
      <ScreenInfoText
        title={t('Crypto.Register.VerifyMnemonic.Title')}
        textLines={[t('Crypto.Register.VerifyMnemonic.Text')]}
      />
      <CandidateWords candidates={candidates} onPress={toggle} />
      <View style={styles.words}>
        <WordsCard words={slots} hidden={hidden} testKey="CryptoVerifyWord" />
      </View>
      {wrongOrder && <Text style={styles.error}>{t('Crypto.Register.VerifyMnemonic.WrongOrder')}</Text>}
      {!!error && <Text style={styles.error}>{t(error)}</Text>}
      <View style={styles.buttons}>
        <Button
          title={t('Global.Continue')}
          buttonType={ButtonType.Primary}
          disabled={!isCorrect || isSaving}
          onPress={store}
          testID={testIdWithKey('CryptoVerifyContinue')}
        />
        <Button
          title={t('Crypto.Register.VerifyMnemonic.Reset')}
          buttonType={ButtonType.Secondary}
          onPress={reset}
          testID={testIdWithKey('CryptoVerifyReset')}
        />
      </View>
    </ScrollView>
  )
}
