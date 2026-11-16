import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'

import { SegmentedControl } from '../components/SegmentedControl'
import { SignatureHistory } from '../components/SignatureHistory'
import { TransactionHistory } from '../components/TransactionHistory'

const TRANSACTIONS = 'transactions'
const SIGNATURES = 'signatures'

const useStyles = ({ Spacing }: HekaTheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    switcher: { padding: Spacing.md },
  })

/** Own sends and chain history, and under "Signatures" what the holder signed for relying parties. */
export const History: React.FC = () => {
  const styles = useStyles(useHekaTheme())
  const { t } = useTranslation()
  const [selected, setSelected] = useState(TRANSACTIONS)

  return (
    <View style={styles.container}>
      <View style={styles.switcher}>
        <SegmentedControl
          options={[
            { id: TRANSACTIONS, label: t('Crypto.History.Transactions') },
            { id: SIGNATURES, label: t('Crypto.History.Signatures') },
          ]}
          selectedId={selected}
          onSelect={setSelected}
          testIdPrefix="CryptoHistoryTab"
        />
      </View>
      {selected === SIGNATURES ? <SignatureHistory /> : <TransactionHistory />}
    </View>
  )
}
