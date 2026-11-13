import type { FeeQuote, TransferRequest, TxRecord } from '@heka-wallet/crypto-core'

import { KeyLockedError, PendingSendError } from '@heka-wallet/crypto-core'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCrypto } from '../provider/CryptoContext'

import { useAuthProof } from './useAuthProof'

const errorKey = (error: unknown): string => {
  if (error instanceof PendingSendError) return 'Crypto.Send.Errors.Pending'
  if (error instanceof KeyLockedError) return 'Crypto.Send.Errors.Locked'
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

  const submit = useCallback(
    async (request: TransferRequest, quote: FeeQuote) => {
      setError(undefined)
      // Send needs no proof in the key provider; the check makes sure the holder is the one sending.
      if (!(await auth.request())) return
      setSending(true)
      try {
        setSent(await transactions.submit(request, quote))
        balances.notifySent()
      } catch (cause) {
        logger.error('Send failed', { chainId: request.from.chainId, error: String(cause) })
        setError(errorKey(cause))
      } finally {
        setSending(false)
      }
    },
    [auth, transactions, balances, logger]
  )

  return { submit, sent, isSending, error, gateProps: auth.gateProps }
}
