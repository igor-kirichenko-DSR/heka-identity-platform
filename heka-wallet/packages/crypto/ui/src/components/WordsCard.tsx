import { testIdWithKey } from '@bifold/core'
import { useGlobalStyles } from '@heka-wallet/shared'
import React from 'react'
import { StyleSheet, View } from 'react-native'

import { NEW_PHRASE_COLUMNS } from '../constants'

import { WordChip } from './WordChip'

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
})

export interface WordSlot {
  /** Empty while the holder has not placed a word here. */
  value: string
  highlighted?: boolean
}

interface Props {
  words: WordSlot[]
  /** Blanks every word, e.g. while the app is in the background. */
  hidden?: boolean
  /** Bare key: the card gets testIdWithKey(key) and word n gets testIdWithKey(`${key}-${n}`). */
  testKey: string
  columns?: number
}

const HIDDEN_WORD = '•••••'

export const WordsCard: React.FC<Props> = ({ words, hidden, testKey, columns = NEW_PHRASE_COLUMNS }) => {
  const globalStyles = useGlobalStyles()

  return (
    <View style={[globalStyles.multilineTextCard, styles.grid]} testID={testIdWithKey(testKey)}>
      {words.map((slot, index) => (
        <WordChip
          key={index}
          position={index + 1}
          word={hidden ? HIDDEN_WORD : slot.value}
          highlighted={slot.highlighted}
          columns={columns}
          testID={testIdWithKey(`${testKey}-${index + 1}`)}
        />
      ))}
    </View>
  )
}
