import type { TxDirection, TxRecord } from '@heka-wallet/crypto-core'

import { testIdWithKey } from '@bifold/core'
import type { IconName } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { formatAmount, LIST_FRACTION_DIGITS, shortAddress } from '../utils/format'

import { ListItem } from './ListItem'
import { StatusChip } from './StatusChip'

const SIGN: Record<TxDirection, string> = { in: '+', out: '−', self: '' }
const ICON: Record<TxDirection, IconName> = {
  in: 'arrow-down-circle',
  out: 'arrow-up-circle',
  self: 'arrow-repeat',
}

interface Props {
  record: TxRecord
  onPress: (record: TxRecord) => void
}

/** One history entry; tapping opens it in the explorer. */
export const TxListItem: React.FC<Props> = ({ record, onPress }) => {
  const { t } = useTranslation()
  const counterparty = t(`Crypto.History.Direction.${record.direction}`, { address: shortAddress(record.counterparty) })

  return (
    <ListItem
      icon={ICON[record.direction]}
      label={`${SIGN[record.direction]}${formatAmount(record.amount, record.asset, LIST_FRACTION_DIGITS)}`}
      paragraph={`${counterparty}
${new Date(record.createdAt).toLocaleString()}`}
      right={<StatusChip status={record.status} />}
      onPress={() => onPress(record)}
      testID={testIdWithKey(`CryptoTx-${record.txId}`)}
    />
  )
}
