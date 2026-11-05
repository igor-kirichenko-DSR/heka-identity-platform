import { parseMnemonic, parseRawKey } from '@heka-wallet/crypto-core'
import { useCallback, useState } from 'react'

import { useCrypto } from '../provider/CryptoContext'

import { useStoreSeed } from './useStoreSeed'

const BIP39_WORD_COUNTS = [12, 15, 18, 21, 24]
const RAW_KEY_PREFIX = /^0x/i

export type ImportKind = 'mnemonic' | 'raw'

const validationError = (input: string, kind: ImportKind): string | undefined => {
  try {
    if (kind === 'raw') parseRawKey(input)
    else if (!BIP39_WORD_COUNTS.includes(input.trim().split(/\s+/).length)) return 'Crypto.Import.Errors.WordCount'
    else parseMnemonic(input)
    return undefined
  } catch {
    // The parsers' messages are for logs; the holder gets a translated text without the secret.
    return kind === 'raw' ? 'Crypto.Import.Errors.InvalidKey' : 'Crypto.Import.Errors.InvalidPhrase'
  }
}

/** Import by recovery phrase or by a 0x raw key, told apart by the prefix. */
export const useImportWallet = () => {
  const { wallet } = useCrypto()
  const { save, isSaving, error: saveError } = useStoreSeed()
  const [input, setInputValue] = useState('')
  const [error, setError] = useState<string>()
  const kind: ImportKind = RAW_KEY_PREFIX.test(input.trim()) ? 'raw' : 'mnemonic'

  const setInput = useCallback((value: string) => {
    setInputValue(value)
    setError(undefined)
  }, [])

  const submit = useCallback(async () => {
    const invalid = validationError(input, kind)
    setError(invalid)
    if (invalid) return
    await save(() => (kind === 'raw' ? wallet.importRawKey(input.trim()) : wallet.importPhrase(input)))
  }, [input, kind, save, wallet])

  return {
    input,
    setInput,
    kind,
    error: error ?? saveError,
    isSaving,
    canSubmit: input.trim().length > 0 && !isSaving,
    submit,
  }
}
