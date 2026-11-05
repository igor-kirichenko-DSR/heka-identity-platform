import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, IconButton, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'

const useStyles = ({ Spacing }: HekaTheme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing.md },
  })

interface Props {
  onReceive: () => void
  onSend: () => void
  onHistory: () => void
  onSettings: () => void
  /** Send needs an account on the current chain. */
  canSend: boolean
}

export const HomeActions: React.FC<Props> = ({ onReceive, onSend, onHistory, onSettings, canSend }) => {
  const styles = useStyles(useHekaTheme())
  const { t } = useTranslation()

  return (
    <View style={styles.row}>
      <IconButton
        iconName="arrow-down-circle"
        label={t('Crypto.Home.Receive')}
        onPress={onReceive}
        testId={testIdWithKey('CryptoReceive')}
      />
      {canSend && (
        <IconButton
          iconName="arrow-up-circle"
          label={t('Crypto.Home.Send')}
          onPress={onSend}
          testId={testIdWithKey('CryptoSend')}
        />
      )}
      <IconButton
        iconName="clock-history"
        accessibilityLabel={t('Crypto.Home.History')}
        onPress={onHistory}
        testId={testIdWithKey('CryptoHistory')}
      />
      <IconButton
        iconName="gear"
        accessibilityLabel={t('Crypto.Home.Settings')}
        onPress={onSettings}
        testId={testIdWithKey('CryptoSettings')}
      />
    </View>
  )
}
