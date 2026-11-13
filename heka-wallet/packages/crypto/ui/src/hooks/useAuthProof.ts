import type { AuthGateProps } from '../components/AuthGate'
import type { AuthProof } from '@heka-wallet/crypto-core'

import { useStore } from '@bifold/core'
import { authenticateByBiometry, isBiometryCancelledError } from '@heka-wallet/shared'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useCrypto } from '../provider/CryptoContext'

type Resolve = (proof: AuthProof | undefined) => void

export interface AuthProofRequest {
  /** Resolves with a fresh one-use proof, or undefined when the holder cancelled. */
  request: () => Promise<AuthProof | undefined>
  gateProps: AuthGateProps
}

/** Fresh PIN or biometry before reveal, remove and send; biometry first when the holder turned it on. */
export const useAuthProof = (title: string): AuthProofRequest => {
  const { authIssuer, logger } = useCrypto()
  const [store] = useStore()
  const useBiometry = store.preferences.useBiometry
  const [pinVisible, setPinVisible] = useState(false)
  const pending = useRef<Resolve | undefined>(undefined)

  const finish = useCallback((proof: AuthProof | undefined) => {
    setPinVisible(false)
    pending.current?.(proof)
    pending.current = undefined
  }, [])

  const request = useCallback(async (): Promise<AuthProof | undefined> => {
    pending.current?.(undefined)
    if (useBiometry) {
      try {
        await authenticateByBiometry(title)
        return authIssuer.issue()
      } catch (error) {
        const name = error instanceof Error ? error.name : String(error)
        if (!isBiometryCancelledError(name)) logger.warn('Biometry failed; asking for the PIN', { error: name })
      }
    }
    return new Promise<AuthProof | undefined>((resolve) => {
      pending.current = resolve
      setPinVisible(true)
    })
  }, [useBiometry, title, authIssuer, logger])

  const onSuccess = useCallback(() => finish(authIssuer.issue()), [finish, authIssuer])
  const onClose = useCallback(() => finish(undefined), [finish])

  // A screen left with the PIN prompt open: the waiting caller gets "cancelled".
  useEffect(() => () => pending.current?.(undefined), [])

  return { request, gateProps: { visible: pinVisible, title, onSuccess, onClose } }
}
