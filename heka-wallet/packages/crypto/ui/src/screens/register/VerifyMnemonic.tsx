import { ButtonType, testIdWithKey, usePreventScreenCapture } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { CandidateWords } from '../../components/CandidateWords'
import { InfoLines } from '../../components/InfoLines'
import { RegisterFooter } from '../../components/RegisterFooter'
import { WordsCard } from '../../components/WordsCard'
import { VERIFY_GRID_COLUMNS } from '../../constants'
import { useHideOnBackground } from '../../hooks/useHideOnBackground'
import { useScrollContent } from '../../hooks/useScrollContent'
import { useVerifyPhrase } from '../../hooks/useVerifyPhrase'
import { CryptoScreens } from '../../navigators/routes'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    words: { marginTop: Spacing.md },
    error: { ...TextTheme.caption, color: ColorPalette.semantic.error, marginTop: Spacing.xs },
  })

interface Props {
  phrase: string
}

/** The phrase is stored only here, after the holder has put the missing words back in order. */
export const VerifyMnemonic: React.FC<Props> = ({ phrase }) => {
  usePreventScreenCapture()
  const styles = useStyles(useHekaTheme())
  const scrollContent = useScrollContent()
  const { t } = useTranslation()
  const { slots, candidates, toggle, reset, isComplete, isCorrect, store, isSaving, error } = useVerifyPhrase(phrase)
  const hidden = useHideOnBackground()
  const wrongOrder = isComplete && !isCorrect

  return (
    <ScrollView contentContainerStyle={scrollContent}>
      <InfoLines lines={[t('Crypto.Register.VerifyMnemonic.Text')]} />
      <CandidateWords candidates={candidates} onPress={toggle} />
      <View style={styles.words}>
        <WordsCard words={slots} hidden={hidden} testKey="CryptoVerifyWord" columns={VERIFY_GRID_COLUMNS} />
      </View>
      {wrongOrder && <Text style={styles.error}>{t('Crypto.Register.VerifyMnemonic.WrongOrder')}</Text>}
      {!!error && <Text style={styles.error}>{t(error)}</Text>}
      <RegisterFooter
        screen={CryptoScreens.VerifyMnemonic}
        actions={[
          {
            title: t('Global.Continue'),
            onPress: store,
            disabled: !isCorrect,
            isLoading: isSaving,
            testID: testIdWithKey('CryptoVerifyContinue'),
          },
          {
            title: t('Crypto.Register.VerifyMnemonic.Reset'),
            type: ButtonType.Secondary,
            onPress: reset,
            testID: testIdWithKey('CryptoVerifyReset'),
          },
        ]}
      />
    </ScrollView>
  )
}
