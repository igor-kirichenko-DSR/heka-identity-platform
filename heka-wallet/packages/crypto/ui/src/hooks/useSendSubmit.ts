import type { FeeQuote, TransferRequest, TxRecord } from '@heka-wallet/crypto-core'

import {
  ForeignDelegationError,
  KeyLockedError,
  PaymasterUnavailableError,
  PendingSendError,
} from '@heka-wallet/crypto-core'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCrypto } from '../provider/CryptoContext'

import { useAuthProof } from './useAuthProof'

const errorKey = (error: unknown): string => {
  if (error instanceof PendingSendError) return 'Crypto.Send.Errors.Pending'
  if (error instanceof KeyLockedError) return 'Crypto.Send.Errors.Locked'
  if (error instanceof ForeignDelegationError) return 'Crypto.Send.Errors.ForeignDelegation'
  return 'Crypto.Send.Errors.Failed'
}

/** Fresh PIN or biometry, then sign and submit; the send stays pending until the status poll settles it. */
export const useSendSubmit = () => {
  const { transactions, balances, logger } = useCrypto()
  const { t } = useTranslation()
  const auth = useAuthProof(t('Crypto.Send.Confirm'))
  const [sent, setSent] = useState<TxRecord>()
  const [isSending, setSending] = useState(false)
  const [error, setError] = useState<string>()
  // The USDC path failed before anything was sent: the holder decides whether to pay the fee in the native asset
  const [offerNative, setOfferNative] = useState(false)

  const submit = useCallback(
    async (request: TransferRequest, quote: FeeQuote) => {
      setError(undefined)
      setOfferNative(false)
      // Send needs no proof in the key provider; the check makes sure the holder is the one sending.
      if (!(await auth.request())) return
      setSending(true)
      try {
        setSent(await transactions.submit(request, quote))
        balances.notifySent()
      } catch (cause) {
        logger.error('Send failed', { chainId: request.from.chainId, error: String(cause) })
        if (cause instanceof PaymasterUnavailableError) setOfferNative(true)
        else setError(errorKey(cause))
      } finally {
        setSending(false)
      }
    },
    [auth, transactions, balances, logger]
  )

  const dismissNativeOffer = useCallback(() => setOfferNative(false), [])

  return { submit, sent, isSending, error, offerNative, dismissNativeOffer, gateProps: auth.gateProps }
}
