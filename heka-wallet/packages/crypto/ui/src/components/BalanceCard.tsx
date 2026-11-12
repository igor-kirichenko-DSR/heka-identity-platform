import { Button, ButtonType, testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { type AssetBalance } from '../hooks/useHome'
import { formatAmount, LIST_FRACTION_DIGITS } from '../utils/format'

import { AddressPill } from './AddressPill'
import { AssetBalanceBlock } from './AssetBalanceBlock'
import { HeroBalance } from './HeroBalance'

const useStyles = ({ Spacing, BorderRadius, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    card: {
      padding: Spacing.md,
      gap: Spacing.sm,
      borderRadius: BorderRadius.medium,
      backgroundColor: ColorPalette.grayscale.white,
    },
    title: { ...TextTheme.headingFour, textAlign: 'center' },
    others: { flexDirection: 'row', gap: Spacing.sm },
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
}

const amountOf = ({ asset, balance }: AssetBalance) =>
  balance === undefined ? undefined : formatAmount(balance, asset, LIST_FRACTION_DIGITS)

/** The Home card: network, address, the hero balance, the other assets and the Send / Receive buttons. */
export const BalanceCard: React.FC<Props> = ({ title, address, hero, others, onSend, onReceive }) => {
  const styles = useStyles(useHekaTheme())
  const { t } = useTranslation()

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <AddressPill address={address} />
      {hero && (
        <HeroBalance
          label={t('Crypto.Home.BalanceOf', { symbol: hero.asset.symbol })}
          amount={amountOf(hero)}
          testID={testIdWithKey(`CryptoBalance-${hero.asset.symbol}`)}
        />
      )}
      <View style={styles.others}>
        {others.map((row) => (
          <AssetBalanceBlock
            key={row.asset.id}
            label={row.asset.symbol}
            amount={amountOf(row)}
            testID={testIdWithKey(`CryptoBalance-${row.asset.symbol}`)}
          />
        ))}
      </View>
      <View style={styles.actions}>
        <Button
          title={t('Crypto.Home.Send')}
          accessibilityLabel={t('Crypto.Home.Send')}
          buttonType={ButtonType.Primary}
          onPress={onSend}
          testID={testIdWithKey('CryptoSend')}
        />
        <Button
          title={t('Crypto.Home.Receive')}
          accessibilityLabel={t('Crypto.Home.Receive')}
          buttonType={ButtonType.Secondary}
          onPress={onReceive}
          testID={testIdWithKey('CryptoReceive')}
        />
      </View>
    </View>
  )
}
