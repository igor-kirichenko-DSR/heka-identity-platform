import type { WordSlot } from '../components/WordsCard'

import { randomSort } from '@heka-wallet/shared'
import { useCallback, useMemo, useState } from 'react'

import { VERIFY_WORD_COUNT } from '../constants'

export interface Candidate {
  word: string
  /** Index of the phrase slot this candidate fills; undefined while unused. */
  slot?: number
}

const pickHidden = (words: string[]): number[] =>
  randomSort(words.map((_, index) => index))
    .slice(0, VERIFY_WORD_COUNT)
    .sort((a, b) => a - b)

/** Tap-to-order check: some words are taken out of the phrase and the holder puts them back in order. */
export const useVerifyMnemonic = (phrase: string) => {
  const words = useMemo(() => phrase.split(' '), [phrase])
  const [hidden] = useState(() => pickHidden(words))
  const [candidates, setCandidates] = useState<Candidate[]>(() =>
    randomSort(hidden.map((index) => ({ word: words[index] })))
  )

  const filled = useMemo(() => {
    const bySlot = new Map<number, string>()
    candidates.forEach(({ word, slot }) => slot !== undefined && bySlot.set(slot, word))
    return bySlot
  }, [candidates])

  const nextSlot = hidden.find((index) => !filled.has(index))

  const slots: WordSlot[] = words.map((word, index) => ({
    value: hidden.includes(index) ? (filled.get(index) ?? '') : word,
    highlighted: index === nextSlot,
  }))

  const toggle = useCallback(
    (candidateIndex: number) =>
      setCandidates((current) =>
        current.map((candidate, index) => {
          if (index !== candidateIndex) return candidate
          if (candidate.slot !== undefined) return { word: candidate.word }
          return nextSlot === undefined ? candidate : { ...candidate, slot: nextSlot }
        })
      ),
    [nextSlot]
  )

  const reset = useCallback(() => setCandidates((current) => current.map(({ word }) => ({ word }))), [])

  const isComplete = nextSlot === undefined
  const isCorrect = isComplete && hidden.every((index) => filled.get(index) === words[index])

  return { slots, candidates, toggle, reset, isComplete, isCorrect }
}
