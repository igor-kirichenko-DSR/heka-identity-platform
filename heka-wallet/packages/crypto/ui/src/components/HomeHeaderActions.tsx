import { testIdWithKey } from '@bifold/core'
import { IconButton } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  onHistory: () => void
}

/** The History icon in the Home header; Settings is the gear in the balance card. */
export const HomeHeaderActions: React.FC<Props> = ({ onHistory }) => {
  const { t } = useTranslation()

  return (
    <IconButton
      iconName="clock-history"
      accessibilityLabel={t('Crypto.Home.History')}
      onPress={onHistory}
      testId={testIdWithKey('CryptoHistory')}
    />
  )
}
