import { Button, ButtonType, testIdWithKey, usePreventScreenCapture } from '@bifold/core'
import { type HekaTheme, ScreenInfoText, TextInput, useGlobalStyles, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, View } from 'react-native'

import { useHideOnBackground } from '../../hooks/useHideOnBackground'
import { useImportWallet } from '../../hooks/useImportWallet'

const useStyles = ({ Spacing }: HekaTheme) =>
  StyleSheet.create({
    button: { paddingVertical: Spacing.md },
  })

/**
 * A recovery phrase or a 0x private key: never logged, autocorrect off, screen capture blocked, and blanked (read-only)
 * while the app is in the background.
 */
export const ImportWallet: React.FC = () => {
  usePreventScreenCapture()
  const styles = useStyles(useHekaTheme())
  const globalStyles = useGlobalStyles()
  const { t } = useTranslation()
  const { input, setInput, error, canSubmit, isSaving, submit } = useImportWallet()
  const hidden = useHideOnBackground()

  return (
    <ScrollView contentContainerStyle={globalStyles.defaultContainer} keyboardShouldPersistTaps="handled">
      <ScreenInfoText title={t('Crypto.Import.Title')} textLines={[t('Crypto.Import.Text')]} />
      <TextInput
        label={t('Crypto.Import.Label')}
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
      <View style={styles.button}>
        <Button
          title={t('Crypto.Import.Submit')}
          buttonType={ButtonType.Primary}
          disabled={!canSubmit || isSaving}
          onPress={submit}
          testID={testIdWithKey('CryptoImportSubmit')}
        />
      </View>
    </ScrollView>
  )
}
