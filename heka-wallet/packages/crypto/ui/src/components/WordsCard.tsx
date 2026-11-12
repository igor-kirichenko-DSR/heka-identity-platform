import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { StyleSheet, View } from 'react-native'

import { NEW_PHRASE_COLUMNS } from '../constants'

import { WordChip } from './WordChip'

// The tiles carry their own gap; this pulls the grid back to the screen edge.
const useStyles = ({ Spacing }: HekaTheme) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -Spacing.xs },
  })

export interface WordSlot {
  /** Empty while the holder has not placed a word here. */
  value: string
  /** The next empty slot. */
  highlighted?: boolean
  /** A placed word that is not the right one for this slot. */
  error?: boolean
}

interface Props {
  words: WordSlot[]
  /** Blanks every word, e.g. while the app is in the background. */
  hidden?: boolean
  /** Bare key: the grid gets testIdWithKey(key) and word n gets testIdWithKey(`${key}-${n}`). */
  testKey: string
  columns?: number
}

const HIDDEN_WORD = '•••••'

export const WordsCard: React.FC<Props> = ({ words, hidden, testKey, columns = NEW_PHRASE_COLUMNS }) => {
  const styles = useStyles(useHekaTheme())

  return (
    <View style={styles.grid} testID={testIdWithKey(testKey)}>
      {words.map((slot, index) => (
        <WordChip
          key={index}
          position={index + 1}
          word={hidden ? HIDDEN_WORD : slot.value}
          highlighted={slot.highlighted}
          error={slot.error}
          columns={columns}
          testID={testIdWithKey(`${testKey}-${index + 1}`)}
        />
      ))}
    </View>
  )
}
