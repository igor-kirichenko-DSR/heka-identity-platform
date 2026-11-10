import type { CryptoRegisterStackParams } from '../navigators/types'
import type { StackNavigationProp } from '@react-navigation/stack'

import { InvalidSeedError, SeedExistsError } from '@heka-wallet/crypto-core'
import { useNavigation } from '@react-navigation/native'
import { useCallback, useState } from 'react'

import { useRegisterFlow } from '../navigators/RegisterFlowContext'
import { CryptoScreens } from '../navigators/routes'
import { useCrypto } from '../provider/CryptoContext'

const errorKey = (error: unknown): string => {
  if (error instanceof InvalidSeedError) return 'Crypto.Import.Errors.InvalidPhrase'
  if (error instanceof SeedExistsError) return 'Crypto.Register.Errors.Exists'
  return 'Crypto.Register.Errors.SaveFailed'
}

/** Stores a verified or imported seed, then shows Done; the stack keeps the register flow until Done is left. */
export const useStoreSeed = () => {
  const { logger } = useCrypto()
  const { setFinishing } = useRegisterFlow()
  const navigation = useNavigation<StackNavigationProp<CryptoRegisterStackParams>>()
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const save = useCallback(
    async (store: () => Promise<void>) => {
      setSaving(true)
      setError(undefined)
      setFinishing(true)
      try {
        await store()
        navigation.reset({ index: 0, routes: [{ name: CryptoScreens.RegisterDone }] })
      } catch (cause) {
        setFinishing(false)
        logger.error('Failed to store the wallet seed', { error: cause instanceof Error ? cause.name : 'unknown' })
        setError(errorKey(cause))
      } finally {
        setSaving(false)
      }
    },
    [logger, navigation, setFinishing]
  )

  return { save, isSaving, error }
}
