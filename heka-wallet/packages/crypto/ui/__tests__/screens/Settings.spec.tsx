import { act, fireEvent, screen } from '@testing-library/react-native'
import React from 'react'

import { CryptoScreens } from '../../src/navigators/routes'
import { Settings } from '../../src/screens/Settings'
import { navigation, screenProps } from '../helpers/navigation'
import {
  BASE_SEPOLIA,
  makeChain,
  makeServices,
  MemoryChainPreference,
  OTHER_MNEMONIC,
  OTHER_RAW_KEY,
  renderWithServices,
} from '../helpers/services'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../helpers/mocks').i18nMock())

const HEDERA_EVM = 'eip155:296'

const setup = async (seed: 'mnemonic' | 'raw') => {
  const services = makeServices([makeChain(BASE_SEPOLIA), makeChain(HEDERA_EVM, { name: 'Hedera' })])
  if (seed === 'mnemonic') await services.wallet.importPhrase(OTHER_MNEMONIC)
  else await services.wallet.importRawKey(OTHER_RAW_KEY)
  renderWithServices(<Settings {...screenProps()} />, services)
  await act(async () => undefined)
  return services
}

describe('Settings', () => {
  it('offers to reveal the phrase of a mnemonic wallet', async () => {
    await setup('mnemonic')

    fireEvent.press(screen.getByTestId('CryptoRevealPhrase'))

    expect(navigation.navigate).toHaveBeenCalledWith(CryptoScreens.RevealPhrase)
  })

  it('hides reveal for a raw-key wallet', async () => {
    await setup('raw')

    expect(screen.queryByTestId('CryptoRevealPhrase')).toBeNull()
    expect(screen.getByTestId('CryptoRemoveWallet')).toBeTruthy()
  })

  it('marks the default network with a check', async () => {
    await setup('mnemonic')

    expect(screen.getAllByTestId('Icon-check-lg')).toHaveLength(1)

    await act(async () => fireEvent.press(screen.getByTestId('CryptoChain-Hedera')))

    expect(screen.getAllByTestId('Icon-check-lg')).toHaveLength(1)
    expect(screen.getByText('Crypto.Settings.DefaultChain')).toBeTruthy()
  })

  it('saves the default chain and switches to it', async () => {
    const services = await setup('mnemonic')

    await act(async () => fireEvent.press(screen.getByTestId('CryptoChain-Hedera')))

    expect((services.chainPreference as MemoryChainPreference).set).toHaveBeenCalledWith(HEDERA_EVM)
    expect(services.accounts.currentChainId).toBe(HEDERA_EVM)
  })

  it('shows a failed save of the default chain', async () => {
    const services = await setup('mnemonic')
    ;(services.chainPreference as MemoryChainPreference).set.mockRejectedValueOnce(new Error('disk full'))

    await act(async () => fireEvent.press(screen.getByTestId('CryptoChain-Hedera')))

    expect(screen.getByText('Crypto.Settings.SaveFailed')).toBeTruthy()
  })

  it('opens remove wallet', async () => {
    await setup('mnemonic')

    fireEvent.press(screen.getByTestId('CryptoRemoveWallet'))

    expect(navigation.navigate).toHaveBeenCalledWith(CryptoScreens.RemoveWallet)
  })
})
