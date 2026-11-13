import type { CryptoMainStackParams } from '../navigators/types'
import type { StackScreenProps } from '@react-navigation/stack'

import { testIdWithKey } from '@bifold/core'
import { BootstrapIcon, type HekaTheme, IconSizes, useHekaTheme } from '@heka-wallet/shared'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text } from 'react-native'

import { ListItem } from '../components/ListItem'
import { ListSection } from '../components/ListSection'
import { useScrollContent } from '../hooks/useScrollContent'
import { useSettings } from '../hooks/useSettings'
import { CryptoScreens } from '../navigators/routes'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    error: { ...TextTheme.normal, color: ColorPalette.semantic.error, padding: Spacing.md },
  })

type Props = StackScreenProps<CryptoMainStackParams, CryptoScreens.Settings>

export const Settings: React.FC<Props> = observer(({ navigation }) => {
  const theme = useHekaTheme()
  const styles = useStyles(theme)
  const scrollContent = useScrollContent()
  const { t } = useTranslation()
  const settings = useSettings()

  return (
    <ScrollView contentContainerStyle={scrollContent}>
      {settings.chains.length > 1 && (
        <ListSection title={t('Crypto.Settings.Sections.Network')}>
          {settings.chains.map((chain) => (
            <ListItem
              key={chain.id}
              icon="globe"
              label={chain.name}
              paragraph={chain.id === settings.defaultChainId ? t('Crypto.Settings.DefaultChain') : undefined}
              right={
                chain.id === settings.defaultChainId && (
                  <BootstrapIcon name="check-lg" size={IconSizes.medium} color={theme.ColorPalette.brand.primary} />
                )
              }
              onPress={() => void settings.setDefaultChain(chain.id)}
              testID={testIdWithKey(`CryptoChain-${chain.name}`)}
            />
          ))}
          {settings.saveFailed && <Text style={styles.error}>{t('Crypto.Settings.SaveFailed')}</Text>}
        </ListSection>
      )}
      {settings.canReveal && (
        <ListSection title={t('Crypto.Settings.Sections.Security')}>
          <ListItem
            icon="shield-lock"
            label={t('Crypto.Settings.RevealPhrase')}
            right={<BootstrapIcon name="chevron-right" size={IconSizes.small} color={theme.ColorPalette.brand.icon} />}
            onPress={() => navigation.navigate(CryptoScreens.RevealPhrase)}
            testID={testIdWithKey('CryptoRevealPhrase')}
          />
        </ListSection>
      )}
      <ListSection title={t('Crypto.Settings.Sections.Wallet')}>
        <ListItem
          label={t('Crypto.Settings.RemoveWallet')}
          right={<BootstrapIcon name="trash3" size={IconSizes.medium} color={theme.ColorPalette.semantic.error} />}
          onPress={() => navigation.navigate(CryptoScreens.RemoveWallet)}
          testID={testIdWithKey('CryptoRemoveWallet')}
        />
      </ListSection>
    </ScrollView>
  )
})
