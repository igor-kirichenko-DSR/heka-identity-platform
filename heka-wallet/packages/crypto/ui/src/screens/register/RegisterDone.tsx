import { Button, ButtonType, testIdWithKey } from '@bifold/core'
import { type HekaTheme, ScreenInfoText, useGlobalStyles, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { type BackupState, useBackupPrompt } from '../../hooks/useBackupPrompt'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    status: { ...TextTheme.normal, marginTop: Spacing.md },
    error: { color: ColorPalette.semantic.error },
    buttons: { flex: 1, justifyContent: 'flex-end', gap: Spacing.md, paddingBottom: Spacing.md },
  })

const BACKUP_STATUS_KEYS: Partial<Record<BackupState, string>> = {
  done: 'Crypto.Register.Done.BackupDone',
  failed: 'Crypto.Register.Done.BackupFailed',
}

/** The passkey backup is offered where the app has it; otherwise the written-down phrase is the only backup. */
export const RegisterDone: React.FC = () => {
  const styles = useStyles(useHekaTheme())
  const globalStyles = useGlobalStyles()
  const { t } = useTranslation()
  const { isAvailable, isRawKey, state, backupNow, finish } = useBackupPrompt()
  const noBackupKey = isRawKey ? 'Crypto.Register.Done.RawKeyText' : 'Crypto.Register.Done.PhraseIsBackup'
  const statusKey = BACKUP_STATUS_KEYS[state]
  const offerBackup = isAvailable && state !== 'done'

  return (
    <View style={globalStyles.defaultContainer}>
      <ScreenInfoText
        title={t('Crypto.Register.Done.Title')}
        textLines={[t(isAvailable ? 'Crypto.Register.Done.BackupPrompt' : noBackupKey)]}
      />
      {statusKey && (
        <Text style={[styles.status, state === 'failed' && styles.error]} testID={testIdWithKey('CryptoBackupStatus')}>
          {t(statusKey)}
        </Text>
      )}
      <View style={styles.buttons}>
        {offerBackup && (
          <Button
            title={t('Crypto.Register.Done.BackupNow')}
            buttonType={ButtonType.Primary}
            disabled={state === 'running'}
            onPress={backupNow}
            testID={testIdWithKey('CryptoBackupNow')}
          />
        )}
        <Button
          title={t('Crypto.Register.Done.OpenWallet')}
          buttonType={offerBackup ? ButtonType.Secondary : ButtonType.Primary}
          disabled={state === 'running'}
          onPress={finish}
          testID={testIdWithKey('CryptoOpenWallet')}
        />
      </View>
    </View>
  )
}
