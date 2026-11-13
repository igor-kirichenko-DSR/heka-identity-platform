import type { FeeQuote } from '@heka-wallet/crypto-core'

import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import React from 'react'

import { CryptoScreens } from '../../src/navigators/routes'
import { Send } from '../../src/screens/Send'
import { navigation, screenProps } from '../helpers/navigation'
import {
  BASE_SEPOLIA,
  makeChain,
  makeServices,
  OTHER_MNEMONIC,
  renderWithServices,
  type TestServices,
} from '../helpers/services'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())
jest.mock('@bifold/core/src/components/animated/ButtonLoading', () => require('../helpers/mocks').buttonLoadingMock())
jest.mock('react-i18next', () => require('../helpers/mocks').i18nMock())

const eth = makeChain(BASE_SEPOLIA).nativeAsset
const RECIPIENT = '0x2222222222222222222222222222222222222222'
const TX = '0xabc0000000000000000000000000000000000000000000000000000000000001'
const ONE_ETH = BigInt('1000000000000000000')
const QUOTE_WAIT = { timeout: 3000 }
const STATUS_POLL_MS = 10

const PAYMASTER_CHAIN = makeChain(BASE_SEPOLIA, {
  features: {
    historySource: 'rpc-logs',
    autoCreateOnReceive: false,
    paymaster: { kind: 'circle', version: '0.8', address: '0x1', bundlerUrl: 'https://bundler.test' },
  },
})

const setup = async (params?: { prefill?: { to?: string; amount?: string } }, chain = makeChain(BASE_SEPOLIA)) => {
  const services = makeServices([chain], { statusPollIntervalMs: STATUS_POLL_MS })
  const adapter = services.adapters[0]
  adapter.getBalances.mockResolvedValue({ [eth.id]: ONE_ETH })
  adapter.estimateFee.mockImplementation(
    async (): Promise<FeeQuote> => ({ mode: 'native', asset: eth, amount: BigInt(21000), display: '' })
  )
  adapter.transfer.mockResolvedValue({ txId: TX })
  adapter.getStatus.mockResolvedValue({ status: 'pending' })
  await services.wallet.importPhrase(OTHER_MNEMONIC)
  await services.transactions.init()
  services.balances.start()
  await services.balances.refresh()
  renderWithServices(<Send {...screenProps(params)} />, services)
  return services
}

const fill = async (to: string, amount: string) => {
  fireEvent.changeText(screen.getByTestId('CryptoRecipient'), to)
  fireEvent.changeText(screen.getByTestId('CryptoAmount'), amount)
}

describe('Send', () => {
  const started: TestServices[] = []
  const tracked = async (params?: Parameters<typeof setup>[0], chain?: Parameters<typeof setup>[1]) => {
    const services = await setup(params, chain)
    started.push(services)
    return services
  }
  afterEach(() =>
    started.splice(0).forEach((services) => {
      services.balances.dispose()
      services.transactions.dispose()
    })
  )

  it('shows an invalid address and keeps Send disabled', async () => {
    const services = await tracked()
    services.adapters[0].validateAddress.mockReturnValue({ ok: false })

    await fill('0x123', '0.1')

    expect(screen.getByText('Crypto.Send.Errors.InvalidAddress')).toBeTruthy()
    expect(screen.getByTestId('CryptoSendSubmit')).toBeDisabled()
  })

  it('warns about a recipient this wallet never sent to', async () => {
    await tracked()

    await fill(RECIPIENT, '0.1')

    expect(screen.getByText('Crypto.Send.NewRecipient')).toBeTruthy()
  })

  it('shows no fee mode choice on a chain without a paymaster', async () => {
    await tracked()

    expect(screen.queryByTestId('CryptoFeeMode-ETH')).toBeNull()
  })

  it('offers the USDC fee mode on a chain with a paymaster and quotes in that mode', async () => {
    const services = await tracked(undefined, PAYMASTER_CHAIN)
    await fill(RECIPIENT, '0.1')

    fireEvent.press(screen.getByTestId('CryptoFeeMode-Crypto.Fee.Usdc'))

    await waitFor(
      () =>
        expect(services.adapters[0].estimateFee).toHaveBeenLastCalledWith(
          expect.objectContaining({ feeMode: 'usdc-paymaster' })
        ),
      QUOTE_WAIT
    )
    expect(screen.getByTestId('CryptoFeeMode-ETH')).toBeTruthy()
  })

  it('shows the fee amount under the selected fee mode instead of a separate line', async () => {
    await tracked(undefined, PAYMASTER_CHAIN)
    await fill(RECIPIENT, '0.1')

    await waitFor(() => expect(screen.getByText('0.000000000000021 ETH')).toBeTruthy(), QUOTE_WAIT)
    expect(screen.queryByText(/Crypto.Fee.Estimate/)).toBeNull()
  })

  it('says the fee cannot be paid and keeps Send disabled when amount plus fee exceed the balance', async () => {
    await tracked()

    await fill(RECIPIENT, '1')

    await waitFor(() => expect(screen.getByText('Crypto.Send.Errors.InsufficientFee')).toBeTruthy(), QUOTE_WAIT)
    expect(screen.getByTestId('CryptoSendSubmit')).toBeDisabled()
  })

  it('submits nothing when the PIN is cancelled', async () => {
    const services = await tracked()
    await fill(RECIPIENT, '0.1')
    await waitFor(() => expect(screen.getByTestId('CryptoSendSubmit')).not.toBeDisabled(), QUOTE_WAIT)

    act(() => {
      fireEvent.press(screen.getByTestId('CryptoSendSubmit'))
    })
    await act(async () => fireEvent.press(screen.getByTestId('PinClose')))

    expect(services.adapters[0].transfer).not.toHaveBeenCalled()
  })

  it('sends after the PIN, shows pending, then the final status', async () => {
    const services = await tracked()
    await fill(RECIPIENT, '0.1')
    await waitFor(() => expect(screen.getByTestId('CryptoSendSubmit')).not.toBeDisabled(), QUOTE_WAIT)

    act(() => {
      fireEvent.press(screen.getByTestId('CryptoSendSubmit'))
    })
    await act(async () => fireEvent.press(screen.getByTestId('PinSuccess')))

    await waitFor(() => expect(screen.getByTestId('CryptoStatus-pending')).toBeTruthy())
    expect(services.adapters[0].transfer).toHaveBeenCalledWith(
      expect.objectContaining({ to: RECIPIENT, amount: ONE_ETH / BigInt(10), feeMode: 'native' }),
      services.keys
    )

    services.adapters[0].getStatus.mockResolvedValue({ status: 'success' })
    await waitFor(() => expect(screen.getByTestId('CryptoStatus-success')).toBeTruthy())

    expect(screen.queryByTestId('CryptoOpenExplorer')).toBeNull()
  })

  it('shows a submit failure and stays on the form', async () => {
    const services = await tracked()
    services.adapters[0].transfer.mockRejectedValue(new Error('nonce too low'))
    await fill(RECIPIENT, '0.1')
    await waitFor(() => expect(screen.getByTestId('CryptoSendSubmit')).not.toBeDisabled(), QUOTE_WAIT)

    act(() => {
      fireEvent.press(screen.getByTestId('CryptoSendSubmit'))
    })
    await act(async () => fireEvent.press(screen.getByTestId('PinSuccess')))

    await waitFor(() => expect(screen.getByText('Crypto.Send.Errors.Failed')).toBeTruthy())
    expect(screen.queryByTestId('CryptoSendStatus')).toBeNull()
  })

  it('fills the form from a scanned payment request and clears the params', async () => {
    await tracked({ prefill: { to: RECIPIENT, amount: '250000000000000000' } })

    expect(screen.getByTestId('CryptoRecipient').props.value).toBe(RECIPIENT)
    expect(screen.getByTestId('CryptoAmount').props.value).toBe('0.25')
    expect(navigation.setParams).toHaveBeenCalledWith({ prefill: undefined })
  })

  it('opens the scanner', async () => {
    await tracked()

    fireEvent.press(screen.getByTestId('CryptoScanRecipient'))

    expect(navigation.navigate).toHaveBeenCalledWith(CryptoScreens.ScanAddress)
  })
})
