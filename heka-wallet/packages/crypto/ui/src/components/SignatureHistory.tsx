import type { SignatureRecord } from '@heka-wallet/crypto-core'

import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, StyleSheet, Text } from 'react-native'

import { useScrollContent } from '../hooks/useScrollContent'
import { useSignatures } from '../hooks/useSignatures'
import { shortAddress } from '../utils/format'

import { ListItem } from './ListItem'

const useStyles = ({ Spacing, TextTheme, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    empty: { ...TextTheme.normal, paddingVertical: Spacing.xl, textAlign: 'center' },
    error: { ...TextTheme.normal, color: ColorPalette.semantic.error, paddingVertical: Spacing.sm },
  })

const keyOf = (record: SignatureRecord): string => `${record.origin}|${record.id}`

/** The signatures the holder gave to relying parties: who, which kind, with which address, and when. */
export const SignatureHistory: React.FC = () => {
  const styles = useStyles(useHekaTheme())
  const scrollContent = useScrollContent()
  const { t } = useTranslation()
  const { records, failed } = useSignatures()

  return (
    <FlatList
      contentContainerStyle={scrollContent}
      data={records}
      keyExtractor={keyOf}
      renderItem={({ item }) => (
        <ListItem
          icon="pen"
          label={item.origin}
          paragraph={`${t(`Crypto.Sign.Kinds.${item.kind}`)} - ${t(`Crypto.Sign.Branches.${item.branch}`)} - ${shortAddress(item.address)}\n${new Date(item.signedAt).toLocaleString()}`}
          testID={testIdWithKey(`CryptoSignature-${item.id}`)}
        />
      )}
      ListHeaderComponent={failed ? <Text style={styles.error}>{t('Crypto.History.LoadFailed')}</Text> : null}
      ListEmptyComponent={<Text style={styles.empty}>{t('Crypto.History.SignaturesEmpty')}</Text>}
      testID={testIdWithKey('CryptoSignatureList')}
    />
  )
}
