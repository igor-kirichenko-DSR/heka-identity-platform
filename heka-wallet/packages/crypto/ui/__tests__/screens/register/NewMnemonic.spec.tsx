import { act, fireEvent, screen } from '@testing-library/react-native'
import React from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import { CryptoScreens } from '../../../src/navigators/routes'
import { NewMnemonic } from '../../../src/screens/register/NewMnemonic'
import { preventScreenCapture } from '../../helpers/mocks'
import { wordAt } from '../../helpers/words'
import { navigation, screenProps } from '../../helpers/navigation'
import { makeServices, renderWithServices } from '../../helpers/services'

jest.mock('@bifold/core', () => require('../../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../../helpers/mocks').i18nMock())

const WORD_COUNT = 12

describe('NewMnemonic', () => {
  it('shows a new 12-word phrase and blocks screen capture', () => {
    const services = makeServices()
    renderWithServices(<NewMnemonic {...screenProps()} />, services)

    const words = Array.from({ length: WORD_COUNT }, (_, index) => screen.getByTestId(`CryptoPhraseWord-${index + 1}`))
    expect(words).toHaveLength(WORD_COUNT)
    expect(preventScreenCapture).toHaveBeenCalled()
  })

  it('does not store the phrase before it is verified', async () => {
    const services = makeServices()
    renderWithServices(<NewMnemonic {...screenProps()} />, services)

    expect(await services.keys.hasSeed()).toBe(false)
  })

  it('goes on to verification', () => {
    renderWithServices(<NewMnemonic {...screenProps()} />, makeServices())

    fireEvent.press(screen.getByTestId('CryptoPhraseWritten'))

    expect(navigation.navigate).toHaveBeenCalledWith(CryptoScreens.VerifyMnemonic)
  })

  it('blanks the words while the app is in the background', () => {
    let onChange: (state: AppStateStatus) => void = () => undefined
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      onChange = listener as (state: AppStateStatus) => void
      return { remove: jest.fn() } as never
    })
    renderWithServices(<NewMnemonic {...screenProps()} />, makeServices())
    const shown = wordAt('CryptoPhraseWord-1')

    act(() => onChange('background'))
    expect(wordAt('CryptoPhraseWord-1')).not.toBe(shown)

    act(() => onChange('active'))
    expect(wordAt('CryptoPhraseWord-1')).toBe(shown)
  })
})
