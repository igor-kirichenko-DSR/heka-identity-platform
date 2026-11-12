import { Button, ButtonType, testIdWithKey } from '@bifold/core'
import { type HekaTheme, IconButton, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { type AssetBalance } from '../hooks/useHome'
import { formatAmount, LIST_FRACTION_DIGITS } from '../utils/format'

import { AddressPill } from './AddressPill'
import { AssetBalanceBlocks } from './AssetBalanceBlocks'
import { HeroBalance } from './HeroBalance'

const useStyles = ({ Spacing, BorderRadius, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    card: {
      padding: Spacing.md,
      gap: Spacing.sm,
      borderRadius: BorderRadius.big,
      backgroundColor: ColorPalette.grayscale.white,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { ...TextTheme.headingFour, flexShrink: 1 },
    actions: { gap: Spacing.sm, paddingTop: Spacing.sm },
  })

interface Props {
  /** The network name. */
  title: string
  address: string
  hero?: AssetBalance
  others: AssetBalance[]
  onSend: () => void
  onReceive: () => void
  onSettings: () => void
}

const amountOf = ({ asset, balance }: AssetBalance) =>
  balance === undefined ? undefined : formatAmount(balance, asset, LIST_FRACTION_DIGITS)

/** The Home card: network and settings, address, the hero balance, the other assets and the Send / Receive buttons. */
export const BalanceCard: React.FC<Props> = ({ title, address, hero, others, onSend, onReceive, onSettings }) => {
  const styles = useStyles(useHekaTheme())
  const { t } = useTranslation()

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <IconButton
          iconName="gear"
          accessibilityLabel={t('Crypto.Home.Settings')}
          onPress={onSettings}
          testId={testIdWithKey('CryptoSettings')}
        />
      </View>
      <AddressPill address={address} />
      {hero && (
        <HeroBalance
          label={t('Crypto.Home.BalanceOf', { symbol: hero.asset.symbol })}
          amount={amountOf(hero)}
          testID={testIdWithKey(`CryptoBalance-${hero.asset.symbol}`)}
        />
      )}
      <AssetBalanceBlocks rows={others} />
      <View style={styles.actions}>
        <Button
          title={t('Crypto.Home.Send')}
          accessibilityLabel={t('Crypto.Home.Send')}
          buttonType={ButtonType.Secondary}
          onPress={onSend}
          testID={testIdWithKey('CryptoSend')}
        />
        <Button
          title={t('Crypto.Home.Receive')}
          accessibilityLabel={t('Crypto.Home.Receive')}
          buttonType={ButtonType.Tertiary}
          onPress={onReceive}
          testID={testIdWithKey('CryptoReceive')}
        />
      </View>
    </View>
  )
}
