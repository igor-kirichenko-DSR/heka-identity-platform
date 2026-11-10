import Clipboard from '@react-native-clipboard/clipboard'
import { useCallback, useEffect, useRef, useState } from 'react'

import { COPY_FEEDBACK_MS } from '../constants'

/** Copies a public address (never a secret) and shows "copied" for a moment. */
export const useCopyAddress = (address: string | undefined) => {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback(() => {
    if (!address) return
    Clipboard.setString(address)
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }, [address])

  return { copied, copy }
}
