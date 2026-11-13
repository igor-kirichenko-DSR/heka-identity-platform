import Clipboard from '@react-native-clipboard/clipboard'
import { useCallback, useEffect, useRef, useState } from 'react'

import { COPY_FEEDBACK_MS, DEBUG_COPY_TAP_GAP_MS, DEBUG_COPY_TAPS } from '../constants'

/**
 * Test aid, debug builds only: tapping the area several times quickly copies the new phrase, so a tester can paste it
 * into the import screen. `onTap` is undefined in a release build, where the phrase is never copied (F04: no copy).
 */
export const useDebugCopyPhrase = (words: string[]) => {
  const [copied, setCopied] = useState(false)
  const taps = useRef({ count: 0, lastAt: 0 })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const onTap = useCallback(() => {
    const now = Date.now()
    const state = taps.current
    state.count = now - state.lastAt > DEBUG_COPY_TAP_GAP_MS ? 1 : state.count + 1
    state.lastAt = now
    if (state.count < DEBUG_COPY_TAPS) return
    state.count = 0
    Clipboard.setString(words.join(' '))
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }, [words])

  return { copied, onTap: __DEV__ ? onTap : undefined }
}
