import { act, fireEvent, screen } from '@testing-library/react-native'
import React from 'react'

import { RemoveWallet } from '../../src/screens/RemoveWallet'
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
jest.mock('react-i18next', () => require('../helpers/mocks').i18nMock())

const eth = makeChain(BASE_SEPOLIA).nativeAsset

describe('RemoveWallet', () => {
  const started: TestServices[] = []
  afterEach(() => started.splice(0).forEach((services) => services.balances.dispose()))

  const setup = async () => {
    const services = makeServices()
    started.push(services)
    services.adapters[0].getBalances.mockResolvedValue({ [eth.id]: BigInt('2000000000000000000') })
    await services.wallet.importPhrase(OTHER_MNEMONIC)
    services.balances.start()
    await services.balances.refresh()
    renderWithServices(<RemoveWallet {...screenProps()} />, services)
    return services
  }

  it('shows the balances and the warning', async () => {
    await setup()

    expect(screen.getByText('2 ETH')).toBeTruthy()
    expect(screen.getByText('Crypto.Remove.Warning')).toBeTruthy()
  })

  it('removes the seed after the PIN', async () => {
    const services = await setup()

    act(() => {
      fireEvent.press(screen.getByTestId('CryptoRemoveConfirm'))
    })
    await act(async () => fireEvent.press(screen.getByTestId('PinSuccess')))

    expect(services.wallet.status).toBe('none')
    expect(await services.keys.hasSeed()).toBe(false)
  })

  it('keeps the seed when the PIN is cancelled', async () => {
    const services = await setup()

    act(() => {
      fireEvent.press(screen.getByTestId('CryptoRemoveConfirm'))
    })
    await act(async () => fireEvent.press(screen.getByTestId('PinClose')))

    expect(services.wallet.status).toBe('mnemonic')
    expect(await services.keys.hasSeed()).toBe(true)
  })

  it('shows a failure and keeps the seed', async () => {
    const services = await setup()
    jest.spyOn(services.wallet, 'remove').mockRejectedValueOnce(new Error('store closed'))

    act(() => {
      fireEvent.press(screen.getByTestId('CryptoRemoveConfirm'))
    })
    await act(async () => fireEvent.press(screen.getByTestId('PinSuccess')))

    expect(screen.getByText('Crypto.Remove.Failed')).toBeTruthy()
    expect(await services.keys.hasSeed()).toBe(true)
  })

  it('goes back on cancel', async () => {
    await setup()

    fireEvent.press(screen.getByTestId('CryptoRemoveCancel'))

    expect(navigation.goBack).toHaveBeenCalled()
  })
})
