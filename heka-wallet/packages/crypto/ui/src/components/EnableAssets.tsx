import type { AssetDescriptor } from '@heka-wallet/crypto-core'

import { Button, ButtonType, testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    container: { gap: Spacing.xs, paddingVertical: Spacing.xs },
    error: { ...TextTheme.normal, color: ColorPalette.semantic.error },
  })

interface Props {
  assets: AssetDescriptor[]
  enablingId?: string
  failed: boolean
  onEnable: (asset: AssetDescriptor) => void
}

/** Hedera: "Enable USDC" for tokens the account has not associated yet. */
export const EnableAssets: React.FC<Props> = ({ assets, enablingId, failed, onEnable }) => {
  const styles = useStyles(useHekaTheme())
  const { t } = useTranslation()

  return (
    <View style={styles.container}>
      {assets.map((asset) => (
        <Button
          key={asset.id}
          title={t('Crypto.Home.EnableAsset', { symbol: asset.symbol })}
          buttonType={ButtonType.Secondary}
          disabled={enablingId !== undefined}
          onPress={() => onEnable(asset)}
          testID={testIdWithKey(`CryptoEnable-${asset.symbol}`)}
        />
      ))}
      {failed && <Text style={styles.error}>{t('Crypto.Home.EnableAssetFailed')}</Text>}
    </View>
  )
}
