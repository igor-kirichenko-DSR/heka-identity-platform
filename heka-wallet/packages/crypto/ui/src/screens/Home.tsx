import type { CryptoMainStackParams } from '../navigators/types'
import type { StackScreenProps } from '@react-navigation/stack'

import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, useGlobalStyles, useHekaTheme } from '@heka-wallet/shared'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native'

import { ActivationBanner } from '../components/ActivationBanner'
import { AddressCopy } from '../components/AddressCopy'
import { AuthGate } from '../components/AuthGate'
import { BalanceRow } from '../components/BalanceRow'
import { ChainSwitcher } from '../components/ChainSwitcher'
import { EnableAssets } from '../components/EnableAssets'
import { HomeActions } from '../components/HomeActions'
import { useActivation } from '../hooks/useActivation'
import { useHome } from '../hooks/useHome'
import { CryptoScreens } from '../navigators/routes'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    content: { paddingTop: Spacing.md },
    notice: { ...TextTheme.normal, paddingVertical: Spacing.md },
    error: { color: ColorPalette.semantic.error },
  })

type Props = StackScreenProps<CryptoMainStackParams, CryptoScreens.Home>

export const Home: React.FC<Props> = observer(({ navigation }) => {
  const styles = useStyles(useHekaTheme())
  const globalStyles = useGlobalStyles()
  const { t } = useTranslation()
  const home = useHome()
  const activation = useActivation(home.account)

  const onRefresh = () => {
    void home.refresh()
    void activation.reload()
  }

  return (
    <ScrollView
      contentContainerStyle={[globalStyles.defaultContainer, styles.content]}
      refreshControl={<RefreshControl refreshing={home.isRefreshing} onRefresh={onRefresh} />}
      testID={testIdWithKey('CryptoHome')}
    >
      <ChainSwitcher chains={home.chains} currentId={home.chain?.id} onSelect={home.setChain} />
      {activation.isPending && <ActivationBanner />}
      {home.account ? (
        <AddressCopy address={home.account.address} />
      ) : (
        <Text style={styles.notice}>{t('Crypto.Home.NoAccount')}</Text>
      )}
      {home.rows.map(({ asset, balance }) => (
        <BalanceRow key={asset.id} asset={asset} balance={balance} />
      ))}
      {home.hasBalanceError && <Text style={[styles.notice, styles.error]}>{t('Crypto.Home.BalanceFailed')}</Text>}
      <EnableAssets
        assets={activation.disabledAssets}
        enablingId={activation.enabling}
        failed={activation.failed}
        onEnable={activation.enable}
      />
      <HomeActions
        canSend={!!home.account}
        onReceive={() => navigation.navigate(CryptoScreens.Receive)}
        onSend={() => navigation.navigate(CryptoScreens.Send)}
        onHistory={() => navigation.navigate(CryptoScreens.History)}
        onSettings={() => navigation.navigate(CryptoScreens.Settings)}
      />
      <AuthGate {...activation.gateProps} />
    </ScrollView>
  )
})
