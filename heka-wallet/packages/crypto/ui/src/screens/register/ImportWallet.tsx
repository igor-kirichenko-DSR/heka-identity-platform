import { KeyboardView, testIdWithKey, usePreventScreenCapture } from '@bifold/core'
import { type HekaTheme, TextInput, useGlobalStyles, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'

import { InfoLines } from '../../components/InfoLines'
import { RegisterFooter } from '../../components/RegisterFooter'
import { IMPORT_INPUT_MIN_HEIGHT } from '../../constants'
import { useHideOnBackground } from '../../hooks/useHideOnBackground'
import { useImportWallet } from '../../hooks/useImportWallet'
import { useScrollContent } from '../../hooks/useScrollContent'
import { CryptoScreens } from '../../navigators/routes'

const useStyles = ({ Spacing }: HekaTheme) =>
  StyleSheet.create({
    input: { minHeight: IMPORT_INPUT_MIN_HEIGHT, marginBottom: Spacing.sm },
  })

/**
 * A recovery phrase or a 0x private key: never logged, autocorrect off, screen capture blocked, and blanked (read-only)
 * while the app is in the background.
 */
export const ImportWallet: React.FC = () => {
  usePreventScreenCapture()
  const styles = useStyles(useHekaTheme())
  const globalStyles = useGlobalStyles()
  const scrollContent = useScrollContent()
  const { t } = useTranslation()
  const { input, setInput, error, canSubmit, isSaving, submit } = useImportWallet()
  const hidden = useHideOnBackground()

  return (
    <KeyboardView scrollViewProps={{ contentContainerStyle: scrollContent }}>
      <InfoLines lines={[t('Crypto.Import.Text')]} />
      <TextInput
        label={t('Crypto.Import.Label')}
        style={[globalStyles.multilineTextCard, styles.input]}
        value={hidden ? '' : input}
        editable={!hidden}
        onChangeText={setInput}
        error={error ? t(error) : undefined}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        importantForAutofill="no"
        testID={testIdWithKey('CryptoImportInput')}
      />
      <RegisterFooter
        screen={CryptoScreens.ImportWallet}
        actions={[
          {
            title: t('Crypto.Import.Submit'),
            onPress: submit,
            disabled: !canSubmit,
            isLoading: isSaving,
            testID: testIdWithKey('CryptoImportSubmit'),
          },
        ]}
      />
    </KeyboardView>
  )
}
