import type { TxRecord } from '@heka-wallet/crypto-core'

import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { formatAmount, LIST_FRACTION_DIGITS, shortAddress } from '../utils/format'

import { StatusChip } from './StatusChip'

const useStyles = ({ Spacing, TextTheme, BorderWidth, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    row: {
      paddingVertical: Spacing.sm,
      borderBottomWidth: BorderWidth.small,
      borderBottomColor: ColorPalette.grayscale.lightGrey,
      gap: Spacing.xxxs,
    },
    line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    amount: { ...TextTheme.bold },
    caption: { ...TextTheme.caption },
  })

const SIGN = { in: '+', out: '−', self: '' }

interface Props {
  record: TxRecord
  onPress: (record: TxRecord) => void
}

/** One history entry; tapping opens it in the explorer. */
export const TxListItem: React.FC<Props> = ({ record, onPress }) => {
  const styles = useStyles(useHekaTheme())
  const { t } = useTranslation()

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onPress(record)}
      accessibilityRole="button"
      testID={testIdWithKey(`CryptoTx-${record.txId}`)}
    >
      <View style={styles.line}>
        <Text style={styles.amount}>
          {`${SIGN[record.direction]}${formatAmount(record.amount, record.asset, LIST_FRACTION_DIGITS)}`}
        </Text>
        <StatusChip status={record.status} />
      </View>
      <View style={styles.line}>
        <Text style={styles.caption}>
          {t(`Crypto.History.Direction.${record.direction}`, { address: shortAddress(record.counterparty) })}
        </Text>
        <Text style={styles.caption}>{new Date(record.createdAt).toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  )
}
