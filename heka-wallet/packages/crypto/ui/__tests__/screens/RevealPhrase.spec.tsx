import { act, fireEvent, screen } from '@testing-library/react-native'
import React from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import { RevealPhrase } from '../../src/screens/RevealPhrase'
import { authenticateByBiometry, bifoldState, preventScreenCapture } from '../helpers/mocks'
import { navigation } from '../helpers/navigation'
import { makeServices, OTHER_MNEMONIC, renderWithServices } from '../helpers/services'
import { wordAt } from '../helpers/words'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../helpers/mocks').i18nMock())
jest.mock('@react-navigation/native', () => require('../helpers/navigation').nativeMock())

const [firstWord] = OTHER_MNEMONIC.split(' ')

const setup = async () => {
  const services = makeServices()
  await services.wallet.importPhrase(OTHER_MNEMONIC)
  renderWithServices(<RevealPhrase />, services)
  await act(async () => undefined)
  return services
}

describe('RevealPhrase', () => {
  afterEach(() => {
    bifoldState.preferences.useBiometry = false
  })

  it('shows no words before the PIN and blocks screen capture', async () => {
    await setup()

    expect(screen.queryByTestId('CryptoRevealWord-1')).toBeNull()
    expect(screen.getByTestId('PinConfirmation')).toBeTruthy()
    expect(preventScreenCapture).toHaveBeenCalled()
  })

  it('shows the words after the PIN', async () => {
    await setup()

    await act(async () => fireEvent.press(screen.getByTestId('PinSuccess')))

    expect(wordAt('CryptoRevealWord-1')).toBe(`1. ${firstWord}`)
    expect(screen.queryByTestId('CryptoCopyAddress')).toBeNull()
  })

  it('uses biometry first when the holder turned it on', async () => {
    bifoldState.preferences.useBiometry = true
    authenticateByBiometry.mockResolvedValueOnce(undefined)

    await setup()

    expect(wordAt('CryptoRevealWord-1')).toBe(`1. ${firstWord}`)
    expect(screen.queryByTestId('PinConfirmation')).toBeNull()
  })

  it('falls back to the PIN when biometry fails', async () => {
    bifoldState.preferences.useBiometry = true
    authenticateByBiometry.mockRejectedValueOnce(Object.assign(new Error('no match'), { name: 'AuthenticationFailed' }))

    await setup()

    expect(screen.getByTestId('PinConfirmation')).toBeTruthy()
  })

  it('goes back without showing anything when the PIN is cancelled', async () => {
    await setup()

    await act(async () => fireEvent.press(screen.getByTestId('PinClose')))

    expect(navigation.goBack).toHaveBeenCalled()
    expect(screen.queryByTestId('CryptoRevealWord-1')).toBeNull()
  })

  it('blanks the words while the app is in the background', async () => {
    let onChange: (state: AppStateStatus) => void = () => undefined
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      onChange = listener as (state: AppStateStatus) => void
      return { remove: jest.fn() } as never
    })
    await setup()
    await act(async () => fireEvent.press(screen.getByTestId('PinSuccess')))

    act(() => onChange('inactive'))

    expect(wordAt('CryptoRevealWord-1')).not.toContain(firstWord)
  })
})
