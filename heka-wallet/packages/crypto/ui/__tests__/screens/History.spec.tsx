import type { TxRecord } from '@heka-wallet/crypto-core'

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import React from 'react'
import { Linking } from 'react-native'

import { History } from '../../src/screens/History'
import {
  BASE_SEPOLIA,
  makeServices,
  OTHER_MNEMONIC,
  OTHER_PAYMENT_0,
  renderWithServices,
  usdcOn,
} from '../helpers/services'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../helpers/mocks').i18nMock())
jest.mock('@react-navigation/native', () => require('../helpers/navigation').nativeMock())

const T0 = Date.UTC(2026, 10, 10, 12, 0, 0)
const PEER = '0x2222222222222222222222222222222222222222'

const record = (txId: string, createdAt: number, overrides: Partial<TxRecord> = {}): TxRecord => ({
  chainId: BASE_SEPOLIA,
  account: OTHER_PAYMENT_0,
  txId,
  explorerHash: txId,
  direction: 'in',
  asset: usdcOn(BASE_SEPOLIA),
  amount: BigInt(1000000),
  counterparty: PEER,
  status: 'success',
  createdAt,
  source: 'chain',
  ...overrides,
})

const setup = async (pages: { items: TxRecord[]; next?: string }[]) => {
  const services = makeServices()
  const adapter = services.adapters[0]
  pages.forEach((page) => adapter.getHistory.mockResolvedValueOnce(page))
  adapter.getHistory.mockResolvedValue({ items: [] })
  await services.wallet.importPhrase(OTHER_MNEMONIC)
  renderWithServices(<History />, services)
  await waitFor(() => expect(adapter.getHistory).toHaveBeenCalled())
  await act(async () => undefined)
  return { services, adapter }
}

const rowIds = () =>
  within(screen.getByTestId('CryptoHistoryList'))
    .queryAllByTestId(/^CryptoTx-/)
    .map((row) => row.props.testID)

describe('History', () => {
  it('lists chain history newest first with status chips', async () => {
    await setup([{ items: [record('0x1', T0), record('0x2', T0 + 1000, { status: 'failed' })] }])

    expect(rowIds()).toEqual(['CryptoTx-0x2', 'CryptoTx-0x1'])
    expect(screen.getByTestId('CryptoStatus-failed')).toBeTruthy()
    expect(screen.getByTestId('CryptoStatus-success')).toBeTruthy()
  })

  it('shows the direction icon and the signed amount of each entry', async () => {
    await setup([{ items: [record('0x1', T0), record('0x2', T0 + 1000, { direction: 'out' })] }])

    expect(screen.getByTestId('Icon-arrow-down-circle')).toBeTruthy()
    expect(screen.getByTestId('Icon-arrow-up-circle')).toBeTruthy()
    expect(screen.getByText('+1 USDC')).toBeTruthy()
    expect(screen.getByText('−1 USDC')).toBeTruthy()
  })

  it('loads the next page when the end of the list is reached', async () => {
    const { adapter } = await setup([
      { items: [record('0x1', T0)], next: 'cursor-2' },
      { items: [record('0x0', T0 - 1000)] },
    ])

    await act(async () => screen.getByTestId('CryptoHistoryList').props.onEndReached())

    expect(adapter.getHistory).toHaveBeenLastCalledWith(expect.anything(), 'cursor-2')
    expect(rowIds()).toEqual(['CryptoTx-0x1', 'CryptoTx-0x0'])
  })

  it('notes that logs-based history may miss older and inbound native transfers', async () => {
    await setup([{ items: [] }])

    expect(screen.getByText('Crypto.History.PartialNote')).toBeTruthy()
    expect(screen.getByText('Crypto.History.Empty')).toBeTruthy()
  })

  it('opens an entry in the explorer', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    await setup([{ items: [record('0x1', T0)] }])

    fireEvent.press(screen.getByTestId('CryptoTx-0x1'))

    expect(openURL).toHaveBeenCalledWith('https://explorer.test/tx/0x1')
  })

  it('shows a failed page load', async () => {
    const services = makeServices()
    services.adapters[0].getHistory.mockRejectedValue(new Error('rpc down'))
    await services.wallet.importPhrase(OTHER_MNEMONIC)
    renderWithServices(<History />, services)

    await waitFor(() => expect(screen.getByText('Crypto.History.LoadFailed')).toBeTruthy())
  })
})
