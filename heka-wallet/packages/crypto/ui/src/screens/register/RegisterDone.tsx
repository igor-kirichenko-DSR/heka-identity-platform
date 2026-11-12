import { ButtonType, testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import type { BottomAction } from '../../components/BottomActions'

import { InfoLines } from '../../components/InfoLines'
import { RegisterFooter } from '../../components/RegisterFooter'
import { RegisterIllustration } from '../../components/RegisterIllustration'
import { type BackupState, useBackupPrompt } from '../../hooks/useBackupPrompt'
import { useScrollContent } from '../../hooks/useScrollContent'
import { CryptoScreens } from '../../navigators/routes'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    illustration: { alignItems: 'center', paddingVertical: Spacing.xl },
    status: { ...TextTheme.labelTitle, textAlign: 'center', marginTop: Spacing.md },
    error: { color: ColorPalette.semantic.error },
  })

const BACKUP_STATUS_KEYS: Partial<Record<BackupState, string>> = {
  done: 'Crypto.Register.Done.BackupDone',
  failed: 'Crypto.Register.Done.BackupFailed',
}

/** The passkey backup is offered where the app has it; otherwise the written-down phrase is the only backup. */
export const RegisterDone: React.FC = () => {
  const styles = useStyles(useHekaTheme())
  const scrollContent = useScrollContent()
  const { t } = useTranslation()
  const { isAvailable, isRawKey, state, backupNow, finish } = useBackupPrompt()
  const noBackupKey = isRawKey ? 'Crypto.Register.Done.RawKeyText' : 'Crypto.Register.Done.PhraseIsBackup'
  const statusKey = BACKUP_STATUS_KEYS[state]
  const offerBackup = isAvailable && state !== 'done'
  const actions: BottomAction[] = [
    {
      title: t('Crypto.Register.Done.OpenWallet'),
      type: offerBackup ? ButtonType.Secondary : ButtonType.Primary,
      disabled: state === 'running',
      onPress: finish,
      testID: testIdWithKey('CryptoOpenWallet'),
    },
  ]
  if (offerBackup) {
    actions.unshift({
      title: t('Crypto.Register.Done.BackupNow'),
      disabled: state === 'running',
      onPress: backupNow,
      testID: testIdWithKey('CryptoBackupNow'),
    })
  }

  return (
    <ScrollView contentContainerStyle={scrollContent}>
      <View style={styles.illustration}>
        <RegisterIllustration />
      </View>
      <InfoLines lines={[t(isAvailable ? 'Crypto.Register.Done.BackupPrompt' : noBackupKey)]} />
      {statusKey && (
        <Text style={[styles.status, state === 'failed' && styles.error]} testID={testIdWithKey('CryptoBackupStatus')}>
          {t(statusKey)}
        </Text>
      )}
      <RegisterFooter screen={CryptoScreens.RegisterDone} actions={actions} />
    </ScrollView>
  )
}
