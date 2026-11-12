import type { CryptoMainStackParams } from '../navigators/types'
import type { StackScreenProps } from '@react-navigation/stack'

import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, useGlobalStyles, useHekaTheme } from '@heka-wallet/shared'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native'

import { ActivationBanner } from '../components/ActivationBanner'
import { AuthGate } from '../components/AuthGate'
import { BalanceCard } from '../components/BalanceCard'
import { ChainSwitcher } from '../components/ChainSwitcher'
import { EnableAssets } from '../components/EnableAssets'
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
      <EnableAssets
        assets={activation.disabledAssets}
        enablingId={activation.enabling}
        failed={activation.failed}
        onEnable={activation.enable}
      />
      {home.account ? (
        <BalanceCard
          title={home.chain?.name ?? ''}
          address={home.account.address}
          hero={home.hero}
          others={home.others}
          onSend={() => navigation.navigate(CryptoScreens.Send)}
          onReceive={() => navigation.navigate(CryptoScreens.Receive)}
        />
      ) : (
        <Text style={styles.notice}>{t('Crypto.Home.NoAccount')}</Text>
      )}
      {home.hasBalanceError && <Text style={[styles.notice, styles.error]}>{t('Crypto.Home.BalanceFailed')}</Text>}
      <AuthGate {...activation.gateProps} />
    </ScrollView>
  )
})
