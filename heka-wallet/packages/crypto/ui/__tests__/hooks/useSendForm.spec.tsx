import type { FeeQuote } from '@heka-wallet/crypto-core'

import { act, renderHook, waitFor } from '@testing-library/react-native'
import React, { type PropsWithChildren } from 'react'

import { useSendForm } from '../../src/hooks/useSendForm'
import { CryptoContext } from '../../src/provider/CryptoContext'
import { BASE_SEPOLIA, makeChain, makeServices, OTHER_MNEMONIC, type TestServices, usdcOn } from '../helpers/services'

const eth = makeChain(BASE_SEPOLIA).nativeAsset
const usdc = usdcOn(BASE_SEPOLIA)
const RECIPIENT = '0x2222222222222222222222222222222222222222'
const ONE_ETH = BigInt('1000000000000000000')
const FEE = BigInt('21000000000000')
const QUOTE_WAIT = { timeout: 3000 }

const setup = async (balances: Record<string, bigint>, chain = makeChain(BASE_SEPOLIA)) => {
  const services = makeServices([chain])
  const adapter = services.adapters[0]
  adapter.getBalances.mockResolvedValue(balances)
  adapter.estimateFee.mockImplementation(
    async (request): Promise<FeeQuote> => ({ mode: request.feeMode, asset: eth, amount: FEE, display: '' })
  )
  await services.wallet.importPhrase(OTHER_MNEMONIC)
  services.balances.start()
  await services.balances.refresh()
  const wrapper = ({ children }: PropsWithChildren) => (
    <CryptoContext.Provider value={services}>{children}</CryptoContext.Provider>
  )
  const hook = renderHook(() => useSendForm(), { wrapper })
  return { services, hook }
}

describe('useSendForm', () => {
  const started: TestServices[] = []
  afterEach(() => started.splice(0).forEach((services) => services.balances.dispose()))

  it('allows a native send when amount plus fee fit, with a quote', async () => {
    const { services, hook } = await setup({ [eth.id]: ONE_ETH })
    started.push(services)

    act(() => {
      hook.result.current.setTo(RECIPIENT)
      hook.result.current.setAmountText('0.5')
    })

    await waitFor(() => expect(hook.result.current.quote).toBeDefined(), QUOTE_WAIT)
    expect(hook.result.current.request?.amount).toBe(ONE_ETH / BigInt(2))
    expect(hook.result.current.canSend).toBe(true)
  })

  it('blocks the send when the native balance cannot pay the fee on top', async () => {
    const { services, hook } = await setup({ [eth.id]: ONE_ETH })
    started.push(services)

    act(() => {
      hook.result.current.setTo(RECIPIENT)
      hook.result.current.setAmountText('1')
    })

    await waitFor(() => expect(hook.result.current.funds).toBe('insufficient-fee'), QUOTE_WAIT)
    expect(hook.result.current.canSend).toBe(false)
  })

  it('"max" on the native asset leaves room for the quoted fee', async () => {
    const { services, hook } = await setup({ [eth.id]: ONE_ETH })
    started.push(services)
    act(() => {
      hook.result.current.setTo(RECIPIENT)
      hook.result.current.setAmountText('0.1')
    })
    await waitFor(() => expect(hook.result.current.quote).toBeDefined(), QUOTE_WAIT)

    act(() => hook.result.current.setMax())

    expect(hook.result.current.amountText).toBe('0.999979')
  })

  it('"max" with no amount yet fills the balance and then leaves room for the fee once quoted', async () => {
    const { services, hook } = await setup({ [eth.id]: ONE_ETH })
    started.push(services)
    act(() => hook.result.current.setTo(RECIPIENT))

    act(() => hook.result.current.setMax())
    expect(hook.result.current.amountText).toBe('1')

    await waitFor(() => expect(hook.result.current.amountText).toBe('0.999979'), QUOTE_WAIT)
    await waitFor(() => expect(hook.result.current.funds).toBe('ok'), QUOTE_WAIT)
  })

  it('"max" on a token takes the whole token balance', async () => {
    const { services, hook } = await setup({ [eth.id]: ONE_ETH, [usdc.id]: BigInt(2500000) })
    started.push(services)

    act(() => hook.result.current.selectAsset(usdc.id))
    act(() => hook.result.current.setMax())

    expect(hook.result.current.amountText).toBe('2.5')
  })

  it('rejects an amount with more decimals than the asset has', async () => {
    const { services, hook } = await setup({ [usdc.id]: BigInt(1) })
    started.push(services)

    act(() => {
      hook.result.current.selectAsset(usdc.id)
      hook.result.current.setAmountText('0.0000001')
    })

    expect(hook.result.current.amountInvalid).toBe(true)
    expect(hook.result.current.request).toBeUndefined()
  })

  it('offers the USDC fee mode only on a chain with a paymaster', async () => {
    const plain = await setup({})
    started.push(plain.services)
    expect(plain.hook.result.current.feeModes).toEqual(['native'])

    const paymaster = makeChain(BASE_SEPOLIA, {
      features: {
        historySource: 'rpc-logs',
        autoCreateOnReceive: false,
        paymaster: { kind: 'circle', version: '0.8', address: '0x1', bundlerUrl: 'https://bundler.test' },
      },
    })
    const withPaymaster = await setup({}, paymaster)
    started.push(withPaymaster.services)
    expect(withPaymaster.hook.result.current.feeModes).toEqual(['native', 'usdc-paymaster'])
  })
})
