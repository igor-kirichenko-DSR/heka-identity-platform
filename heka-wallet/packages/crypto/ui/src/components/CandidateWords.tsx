import type { Candidate } from '../hooks/useVerifyMnemonic'

import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { StyleSheet, View } from 'react-native'

import { CandidateChip } from './CandidateChip'

const useStyles = ({ Spacing }: HekaTheme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.xs },
  })

interface Props {
  candidates: Candidate[]
  onPress: (index: number) => void
}

export const CandidateWords: React.FC<Props> = ({ candidates, onPress }) => {
  const styles = useStyles(useHekaTheme())

  return (
    <View style={styles.row}>
      {candidates.map((candidate, index) => (
        <CandidateChip
          key={index}
          word={candidate.word}
          placed={candidate.slot !== undefined}
          onPress={() => onPress(index)}
          testID={testIdWithKey(`CryptoCandidate-${candidate.word}`)}
        />
      ))}
    </View>
  )
}
