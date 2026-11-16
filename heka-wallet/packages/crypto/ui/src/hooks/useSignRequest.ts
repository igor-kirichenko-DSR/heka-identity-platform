import type { FetchedSigningRequest, SignedRequest, SigningRequestErrorCode } from '@heka-wallet/crypto-core'

import { fetchSigningRequest, postSigningResponse, SigningRequestError } from '@heka-wallet/crypto-core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCrypto } from '../provider/CryptoContext'

import { useAuthProof } from './useAuthProof'

export type SignRequestState =
  | { status: 'loading' }
  | { status: 'ready'; fetched: FetchedSigningRequest; address: string }
  | { status: 'refused'; code: SigningRequestErrorCode }
  | { status: 'signing'; fetched: FetchedSigningRequest; address: string }
  | { status: 'sending'; fetched: FetchedSigningRequest; address: string }
  | { status: 'send-failed'; fetched: FetchedSigningRequest; address: string }
  | { status: 'sign-failed'; fetched: FetchedSigningRequest; address: string }
  | { status: 'done'; fetched: FetchedSigningRequest; address: string }

/** A SigningRequestError carries its own code; anything else is a defect of the wallet, not of the network. */
const codeOf = (error: unknown): SigningRequestErrorCode =>
  error instanceof SigningRequestError ? error.code : 'unexpected'

/** Name and message of an error, for the log; errors here never carry key material. */
const describe = (error: unknown): string => (error instanceof Error ? `${error.name}: ${error.message}` : 'unknown')

/**
 * A relying party's signing request: fetch, check, show, then sign after a fresh PIN or biometry and post the
 * signature. A failed post is retried without asking for the PIN again and without signing twice.
 */
export const useSignRequest = (requestUrl: string) => {
  const { registry, keys, signatures, logger } = useCrypto()
  const { t } = useTranslation()
  const { request: requestAuth, gateProps } = useAuthProof(t('Crypto.Sign.Confirm'))
  const [state, setState] = useState<SignRequestState>({ status: 'loading' })
  const signed = useRef<SignedRequest | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const fetched = await fetchSigningRequest(requestUrl, { allowHttp: __DEV__ })
        const { request } = fetched
        if (!registry.has(request.chain)) throw new SigningRequestError('unsupported', 'The chain is not supported')
        const adapter = registry.get(request.chain)
        if (!adapter.checkSigningRequest || !adapter.signingAddress || !adapter.signRequest) {
          throw new SigningRequestError('unsupported', 'The chain cannot sign requests')
        }
        adapter.checkSigningRequest(request, { requestUrl })
        const address = await adapter.signingAddress(request)
        if (!cancelled) setState({ status: 'ready', fetched, address })
      } catch (error) {
        logger.warn(`A signing request was refused (${codeOf(error)}): ${describe(error)}`)
        if (!cancelled) setState({ status: 'refused', code: codeOf(error) })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [requestUrl, registry, logger])

  const send = useCallback(
    async (current: { fetched: FetchedSigningRequest; address: string }, result: SignedRequest) => {
      const { fetched } = current
      setState({ status: 'sending', ...current })
      try {
        await postSigningResponse(fetched.request, { id: fetched.request.id, ...result }, { allowHttp: __DEV__ })
      } catch (error) {
        logger.warn(`The signature could not be sent (${codeOf(error)}): ${describe(error)}`)
        setState({ status: 'send-failed', ...current })
        return
      }
      try {
        await signatures.put({
          id: fetched.request.id,
          origin: fetched.origin,
          kind: fetched.request.kind,
          chainId: fetched.request.chain,
          branch: fetched.request.branch,
          address: result.address,
          signedAt: Date.now(),
        })
      } catch (error) {
        logger.error('The signature could not be recorded', { error: error instanceof Error ? error.name : 'unknown' })
      }
      setState({ status: 'done', ...current })
    },
    [signatures, logger]
  )

  const sign = useCallback(async () => {
    if (state.status !== 'ready' && state.status !== 'sign-failed' && state.status !== 'send-failed') return
    const { fetched, address } = state
    const current = { fetched, address }
    if (signed.current) return send(current, signed.current)
    if (Date.parse(fetched.request.expiresAt) <= Date.now()) return setState({ status: 'refused', code: 'expired' })
    const proof = await requestAuth()
    if (!proof) return
    setState({ status: 'signing', ...current })
    try {
      const adapter = registry.get(fetched.request.chain)
      if (!adapter.signRequest) throw new SigningRequestError('unsupported', 'The chain cannot sign requests')
      signed.current = await adapter.signRequest(fetched.request, { requestUrl: fetched.requestUrl }, keys, proof)
    } catch (error) {
      logger.warn(`Signing failed (${codeOf(error)}): ${describe(error)}`)
      return setState({ status: 'sign-failed', ...current })
    }
    await send(current, signed.current)
  }, [state, requestAuth, registry, keys, logger, send])

  return { state, sign, gateProps }
}
