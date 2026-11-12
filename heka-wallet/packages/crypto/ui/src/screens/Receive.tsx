import { QRRenderer, testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { AddressCopy } from '../components/AddressCopy'
import { AssetPicker } from '../components/AssetPicker'
import { RECEIVE_QR_SIZE } from '../constants'
import { useReceiveUri } from '../hooks/useReceiveUri'
import { useScrollContent } from '../hooks/useScrollContent'

const useStyles = ({ Spacing, BorderRadius, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    title: { ...TextTheme.headingFour, paddingVertical: Spacing.md },
    qr: {
      alignItems: 'center',
      padding: Spacing.md,
      marginVertical: Spacing.md,
      borderRadius: BorderRadius.medium,
      backgroundColor: ColorPalette.grayscale.white,
    },
    hint: { ...TextTheme.caption, paddingTop: Spacing.md },
  })

/** The address and an EIP-681 QR a payer's wallet reads: chain id, and the token contract for USDC. */
export const Receive: React.FC = observer(() => {
  const styles = useStyles(useHekaTheme())
  const scrollContent = useScrollContent()
  const { t } = useTranslation()
  const { account, chain, assets, asset, selectAsset, uri } = useReceiveUri()

  if (!account || !chain || !asset) {
    return <Text style={styles.hint}>{t('Crypto.Home.NoAccount')}</Text>
  }

  return (
    <ScrollView contentContainerStyle={scrollContent}>
      <Text style={styles.title}>{t('Crypto.Receive.Title', { symbol: asset.symbol, chain: chain.name })}</Text>
      <AssetPicker assets={assets} selectedId={asset.id} onSelect={selectAsset} />
      {uri && (
        <View style={styles.qr} testID={testIdWithKey('CryptoReceiveQr')}>
          <QRRenderer value={uri} size={RECEIVE_QR_SIZE} />
        </View>
      )}
      <AddressCopy address={account.address} />
      <Text style={styles.hint}>{t('Crypto.Receive.Hint', { chain: chain.name })}</Text>
    </ScrollView>
  )
})
