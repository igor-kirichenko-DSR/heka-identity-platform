import type { TxRecord } from '@heka-wallet/crypto-core'

import { Button, ButtonType, testIdWithKey } from '@bifold/core'
import { txKey } from '@heka-wallet/crypto-core'
import { type HekaTheme, useGlobalStyles, useHekaTheme } from '@heka-wallet/shared'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'

import { useExplorerLink } from '../hooks/useExplorerLink'
import { useCrypto } from '../provider/CryptoContext'
import { formatAmount, shortAddress } from '../utils/format'

import { StatusChip } from './StatusChip'

const useStyles = ({ Spacing, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    title: { ...TextTheme.headingFour, paddingVertical: Spacing.md },
    text: { ...TextTheme.normal, paddingVertical: Spacing.xs },
    buttons: { gap: Spacing.md, paddingVertical: Spacing.xl },
  })

interface Props {
  sent: TxRecord
  onDone: () => void
}

/** The send after submission: pending until the store's status poll settles it, then final with the explorer link. */
export const SendStatus: React.FC<Props> = observer(({ sent, onDone }) => {
  const styles = useStyles(useHekaTheme())
  const globalStyles = useGlobalStyles()
  const { t } = useTranslation()
  const { transactions } = useCrypto()
  const openExplorer = useExplorerLink()
  const record = transactions.localRecords.get(txKey(sent.chainId, sent.txId)) ?? sent

  return (
    <View style={globalStyles.defaultContainer} testID={testIdWithKey('CryptoSendStatus')}>
      <Text style={styles.title}>{t(`Crypto.Send.Result.${record.status}`)}</Text>
      <StatusChip status={record.status} />
      <Text style={styles.text}>
        {t('Crypto.Send.Result.Summary', {
          amount: formatAmount(record.amount, record.asset),
          to: shortAddress(record.counterparty),
        })}
      </Text>
      <View style={styles.buttons}>
        <Button
          title={t('Crypto.Explorer')}
          buttonType={ButtonType.Secondary}
          onPress={() => openExplorer(record)}
          testID={testIdWithKey('CryptoOpenExplorer')}
        />
        <Button
          title={t('Global.Done')}
          buttonType={ButtonType.Primary}
          onPress={onDone}
          testID={testIdWithKey('CryptoSendDone')}
        />
      </View>
    </View>
  )
})
