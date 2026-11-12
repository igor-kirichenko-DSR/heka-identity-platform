import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, IconButton, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'

const useStyles = ({ Spacing }: HekaTheme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', paddingRight: Spacing.xs },
  })

interface Props {
  onHistory: () => void
  onSettings: () => void
}

/** History and Settings icons in the Home header. */
export const HomeHeaderActions: React.FC<Props> = ({ onHistory, onSettings }) => {
  const styles = useStyles(useHekaTheme())
  const { t } = useTranslation()

  return (
    <View style={styles.row}>
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
