import type { Candidate } from '../hooks/useVerifyMnemonic'

import { testIdWithKey } from '@bifold/core'
import React from 'react'
import { StyleSheet, View } from 'react-native'

import { CANDIDATE_CHIP_MIN_WIDTH } from '../constants'

import { WordChip } from './WordChip'

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-evenly' },
})

interface Props {
  candidates: Candidate[]
  onPress: (index: number) => void
}

export const CandidateWords: React.FC<Props> = ({ candidates, onPress }) => (
  <View style={styles.row}>
    {candidates.map((candidate, index) => (
      <WordChip
        key={index}
        word={candidate.word}
        selected={candidate.slot !== undefined}
        minWidth={CANDIDATE_CHIP_MIN_WIDTH}
        onPress={() => onPress(index)}
        testID={testIdWithKey(`CryptoCandidate-${candidate.word}`)}
      />
    ))}
  </View>
)
