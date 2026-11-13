import { usePreventScreenCapture } from '@bifold/core'
import { type HekaTheme, ScreenInfoText, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text } from 'react-native'

import { AuthGate } from '../components/AuthGate'
import { WordsCard } from '../components/WordsCard'
import { useHideOnBackground } from '../hooks/useHideOnBackground'
import { useRevealPhrase } from '../hooks/useRevealPhrase'
import { useScrollContent } from '../hooks/useScrollContent'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    error: { ...TextTheme.normal, color: ColorPalette.semantic.error, paddingVertical: Spacing.md },
  })

/** Screen capture blocked, no copy button, words blanked in the background. */
export const RevealPhrase: React.FC = () => {
  usePreventScreenCapture()
  const styles = useStyles(useHekaTheme())
  const scrollContent = useScrollContent()
  const { t } = useTranslation()
  const { words, failed, gateProps } = useRevealPhrase()
  const hidden = useHideOnBackground()

  return (
    <ScrollView contentContainerStyle={scrollContent}>
      <ScreenInfoText title={t('Crypto.Reveal.Title')} textLines={[t('Crypto.Reveal.Warning')]} />
      {words && <WordsCard words={words.map((value) => ({ value }))} hidden={hidden} testKey="CryptoRevealWord" />}
      {failed && <Text style={styles.error}>{t('Crypto.Reveal.Failed')}</Text>}
      <AuthGate {...gateProps} />
    </ScrollView>
  )
}
