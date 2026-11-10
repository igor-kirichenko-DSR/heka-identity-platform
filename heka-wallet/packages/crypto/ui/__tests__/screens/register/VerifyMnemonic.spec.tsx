import { act, fireEvent, screen } from '@testing-library/react-native'
import React from 'react'

import { CryptoScreens } from '../../../src/navigators/routes'
import { VerifyMnemonic } from '../../../src/screens/register/VerifyMnemonic'
import { preventScreenCapture } from '../../helpers/mocks'
import { wordAt } from '../../helpers/words'
import { navigation } from '../../helpers/navigation'
import { makeServices, OTHER_MNEMONIC, renderWithServices } from '../../helpers/services'

jest.mock('@bifold/core', () => require('../../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../../helpers/mocks').i18nMock())
jest.mock('@react-navigation/native', () => require('../../helpers/navigation').nativeMock())

// randomSort is the identity in the shared mock: the first four words are taken out, in phrase order.
const [first, second, third, fourth] = OTHER_MNEMONIC.split(' ')
const tap = (word: string) => fireEvent.press(screen.getByTestId(`CryptoCandidate-${word}`))

describe('VerifyMnemonic', () => {
  it('blocks screen capture', () => {
    renderWithServices(<VerifyMnemonic phrase={OTHER_MNEMONIC} />, makeServices())

    expect(preventScreenCapture).toHaveBeenCalled()
  })

  it('refuses the words in the wrong order and stores nothing', async () => {
    const services = makeServices()
    renderWithServices(<VerifyMnemonic phrase={OTHER_MNEMONIC} />, services)
    ;[second, first, third, fourth].forEach(tap)

    expect(screen.getByText('Crypto.Register.VerifyMnemonic.WrongOrder')).toBeTruthy()
    expect(screen.getByTestId('CryptoVerifyContinue')).toBeDisabled()
    expect(await services.keys.hasSeed()).toBe(false)
  })

  it('takes a word back when it is tapped again, and resets all words', () => {
    renderWithServices(<VerifyMnemonic phrase={OTHER_MNEMONIC} />, makeServices())

    tap(first)
    expect(wordAt('CryptoVerifyWord-1')).toContain(first)
    tap(first)
    expect(wordAt('CryptoVerifyWord-1')).not.toContain(first)
    ;[first, second].forEach(tap)
    fireEvent.press(screen.getByTestId('CryptoVerifyReset'))
    expect(wordAt('CryptoVerifyWord-2')).not.toContain(second)
  })

  it('stores the phrase after the right order and shows Done', async () => {
    const services = makeServices()
    renderWithServices(<VerifyMnemonic phrase={OTHER_MNEMONIC} />, services)
    ;[first, second, third, fourth].forEach(tap)
    await act(async () => fireEvent.press(screen.getByTestId('CryptoVerifyContinue')))

    expect(services.wallet.status).toBe('mnemonic')
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: CryptoScreens.RegisterDone }] })
  })

  it('shows an error and stays when storing fails', async () => {
    const services = makeServices()
    jest.spyOn(services.wallet, 'importPhrase').mockRejectedValueOnce(new Error('store closed'))
    renderWithServices(<VerifyMnemonic phrase={OTHER_MNEMONIC} />, services)
    ;[first, second, third, fourth].forEach(tap)
    await act(async () => fireEvent.press(screen.getByTestId('CryptoVerifyContinue')))

    expect(screen.getByText('Crypto.Register.Errors.SaveFailed')).toBeTruthy()
    expect(navigation.reset).not.toHaveBeenCalled()
  })
})
