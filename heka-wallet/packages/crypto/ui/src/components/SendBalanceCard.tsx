import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { StyleSheet, Text } from 'react-native'

import { useHome } from '../hooks/useHome'

import { AssetBalanceBlocks } from './AssetBalanceBlocks'
import { Card } from './Card'

const useStyles = ({ TextTheme }: HekaTheme) => StyleSheet.create({ title: { ...TextTheme.headingFour } })

/** The top card of Send: the network and what is available on it. */
export const SendBalanceCard: React.FC = observer(() => {
  const styles = useStyles(useHekaTheme())
  const { chain, rows } = useHome()

  return (
    <Card>
      <Text style={styles.title}>{chain?.name ?? ''}</Text>
      <AssetBalanceBlocks rows={rows} />
    </Card>
  )
})
