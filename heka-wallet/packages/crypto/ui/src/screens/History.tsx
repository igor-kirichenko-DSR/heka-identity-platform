import type { TxRecord } from '@heka-wallet/crypto-core'

import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, Loader, useHekaTheme } from '@heka-wallet/shared'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'

import { TxListItem } from '../components/TxListItem'
import { HISTORY_MORE_LOADER_SIZE } from '../constants'
import { useHistory } from '../hooks/useHistory'
import { useScrollContent } from '../hooks/useScrollContent'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    note: { ...TextTheme.caption, paddingVertical: Spacing.sm },
    empty: { ...TextTheme.normal, paddingVertical: Spacing.xl, textAlign: 'center' },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    error: { ...TextTheme.normal, color: ColorPalette.semantic.error, paddingVertical: Spacing.sm },
  })

const keyOf = (record: TxRecord): string => `${record.chainId}|${record.txId}`

export const History: React.FC = observer(() => {
  const styles = useStyles(useHekaTheme())
  const scrollContent = useScrollContent()
  const { t } = useTranslation()
  const history = useHistory()

  return (
    <FlatList
      contentContainerStyle={scrollContent}
      data={history.records}
      keyExtractor={keyOf}
      renderItem={({ item }) => <TxListItem record={item} />}
      onEndReached={history.hasMore ? history.loadMore : undefined}
      refreshControl={<RefreshControl refreshing={false} onRefresh={history.load} />}
      ListHeaderComponent={
        <>
          {history.isPartial && <Text style={styles.note}>{t('Crypto.History.PartialNote')}</Text>}
          {history.failed && <Text style={styles.error}>{t('Crypto.History.LoadFailed')}</Text>}
        </>
      }
      ListEmptyComponent={
        history.isLoading ? (
          <View style={styles.loading}>
            <Loader testID={testIdWithKey('CryptoHistoryLoading')} />
          </View>
        ) : (
          <Text style={styles.empty}>{t('Crypto.History.Empty')}</Text>
        )
      }
      ListFooterComponent={
        history.isLoading && history.records.length > 0 ? (
          <Loader size={HISTORY_MORE_LOADER_SIZE} testID={testIdWithKey('CryptoHistoryLoading')} />
        ) : null
      }
      testID={testIdWithKey('CryptoHistoryList')}
    />
  )
})
