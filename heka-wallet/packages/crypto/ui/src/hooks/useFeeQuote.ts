import type { ChainAdapter, FeeQuote, TransferRequest } from '@heka-wallet/crypto-core'

import { accountKey } from '@heka-wallet/crypto-core'
import { useEffect, useState } from 'react'

import { FEE_QUOTE_DEBOUNCE_MS } from '../constants'
import { useCrypto } from '../provider/CryptoContext'

const requestKey = (request: TransferRequest): string =>
  [
    accountKey(request.from.chainId, request.from.address),
    request.to,
    request.asset.id,
    request.amount,
    request.feeMode,
  ]
    .map(String)
    .join('|')

/** A fee quote for the current form, asked for after the holder stops typing; a stale answer is dropped. */
export const useFeeQuote = (adapter: ChainAdapter | undefined, request: TransferRequest | undefined) => {
  const { logger } = useCrypto()
  const [quote, setQuote] = useState<FeeQuote>()
  const [isQuoting, setQuoting] = useState(false)
  const [failed, setFailed] = useState(false)
  const key = request ? requestKey(request) : undefined
  const [current, setCurrent] = useState<{ key: string; request: TransferRequest }>()

  // The request object is new on every render; the effect below runs only when its content changes.
  if (key !== current?.key) setCurrent(key && request ? { key, request } : undefined)

  useEffect(() => {
    setQuote(undefined)
    setFailed(false)
    if (!adapter || !current) {
      setQuoting(false)
      return
    }
    let cancelled = false
    setQuoting(true)
    const timer = setTimeout(() => {
      adapter
        .estimateFee(current.request)
        .then((result) => !cancelled && setQuote(result))
        .catch((error: unknown) => {
          logger.warn('Fee quote failed', { chainId: current.request.from.chainId, error: String(error) })
          if (!cancelled) setFailed(true)
        })
        .finally(() => !cancelled && setQuoting(false))
    }, FEE_QUOTE_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [adapter, current, logger])

  return { quote, isQuoting, failed }
}
