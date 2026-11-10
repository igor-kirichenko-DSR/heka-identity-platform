import type { TxRecord } from '@heka-wallet/crypto-core'

import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, useGlobalStyles, useHekaTheme } from '@heka-wallet/shared'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text } from 'react-native'

import { TxListItem } from '../components/TxListItem'
import { useExplorerLink } from '../hooks/useExplorerLink'
import { useHistory } from '../hooks/useHistory'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    note: { ...TextTheme.caption, paddingVertical: Spacing.sm },
    empty: { ...TextTheme.normal, paddingVertical: Spacing.xl, textAlign: 'center' },
    error: { ...TextTheme.normal, color: ColorPalette.semantic.error, paddingVertical: Spacing.sm },
  })

const keyOf = (record: TxRecord): string => `${record.chainId}|${record.txId}`

export const History: React.FC = observer(() => {
  const styles = useStyles(useHekaTheme())
  const globalStyles = useGlobalStyles()
  const { t } = useTranslation()
  const history = useHistory()
  const openExplorer = useExplorerLink()

  return (
    <FlatList
      contentContainerStyle={globalStyles.defaultContainer}
      data={history.records}
      keyExtractor={keyOf}
      renderItem={({ item }) => <TxListItem record={item} onPress={openExplorer} />}
      onEndReached={history.hasMore ? history.loadMore : undefined}
      refreshControl={<RefreshControl refreshing={false} onRefresh={history.load} />}
      ListHeaderComponent={
        <>
          {history.isPartial && <Text style={styles.note}>{t('Crypto.History.PartialNote')}</Text>}
          {history.failed && <Text style={styles.error}>{t('Crypto.History.LoadFailed')}</Text>}
        </>
      }
      ListEmptyComponent={history.isLoading ? null : <Text style={styles.empty}>{t('Crypto.History.Empty')}</Text>}
      ListFooterComponent={
        history.isLoading ? <ActivityIndicator testID={testIdWithKey('CryptoHistoryLoading')} /> : null
      }
      testID={testIdWithKey('CryptoHistoryList')}
    />
  )
})
