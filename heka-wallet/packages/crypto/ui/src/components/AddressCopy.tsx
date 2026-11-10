import { testIdWithKey } from '@bifold/core'
import { IconSizes, type HekaTheme, IconButton, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { useCopyAddress } from '../hooks/useCopyAddress'
import { shortAddress } from '../utils/format'

const useStyles = ({ Spacing, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs },
    address: { ...TextTheme.normal, flexShrink: 1 },
  })

interface Props {
  address: string
  /** Show the whole address (Receive) instead of the short form (Home). */
  full?: boolean
}

export const AddressCopy: React.FC<Props> = ({ address, full }) => {
  const styles = useStyles(useHekaTheme())
  const { t } = useTranslation()
  const { copied, copy } = useCopyAddress(address)

  return (
    <View style={styles.row}>
      <Text style={styles.address} selectable testID={testIdWithKey('CryptoAddress')}>
        {full ? address : shortAddress(address)}
      </Text>
      <IconButton
        iconName={copied ? 'clipboard-check' : 'clipboard'}
        iconSize={IconSizes.small}
        label={copied ? t('Crypto.Address.Copied') : undefined}
        accessibilityLabel={t('Crypto.Address.Copy')}
        onPress={copy}
        testId={testIdWithKey('CryptoCopyAddress')}
      />
    </View>
  )
}
