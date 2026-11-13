import Clipboard from '@react-native-clipboard/clipboard'
import { act, fireEvent, screen } from '@testing-library/react-native'
import React from 'react'

import { DEBUG_COPY_TAP_GAP_MS, DEBUG_COPY_TAPS } from '../../../src/constants'
import { NewMnemonic } from '../../../src/screens/register/NewMnemonic'
import { screenProps } from '../../helpers/navigation'
import { makeServices, renderWithServices } from '../../helpers/services'

jest.mock('@bifold/core', () => require('../../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../../helpers/mocks').i18nMock())
jest.mock('@react-navigation/native', () => require('../../helpers/navigation').nativeMock())
jest.mock('@react-native-clipboard/clipboard', () => require('../../helpers/mocks').clipboardMock())

const WORDS_IN_PHRASE = 12
const copied = () => (Clipboard.setString as jest.Mock).mock.calls

const tap = (times: number) => {
  for (let i = 0; i < times; i += 1) fireEvent.press(screen.getByTestId('CryptoPhraseDebugCopy'))
}

describe('NewMnemonic debug copy', () => {
  const dev = __DEV__
  beforeEach(() => (Clipboard.setString as jest.Mock).mockClear())
  afterEach(() => {
    ;(globalThis as unknown as { __DEV__: boolean }).__DEV__ = dev
    jest.useRealTimers()
  })

  it('copies the whole phrase after several quick taps in a debug build', () => {
    renderWithServices(<NewMnemonic {...screenProps()} />, makeServices())

    tap(DEBUG_COPY_TAPS)

    expect(copied()).toHaveLength(1)
    expect(String(copied()[0][0]).split(' ')).toHaveLength(WORDS_IN_PHRASE)
    expect(screen.getByText('Crypto.Debug.PhraseCopied')).toBeTruthy()
  })

  it('does not copy when the taps are slow', () => {
    jest.useFakeTimers()
    renderWithServices(<NewMnemonic {...screenProps()} />, makeServices())

    for (let i = 0; i < DEBUG_COPY_TAPS; i += 1) {
      tap(1)
      act(() => jest.advanceTimersByTime(DEBUG_COPY_TAP_GAP_MS + 1))
    }

    expect(copied()).toHaveLength(0)
  })

  it('never copies in a release build', () => {
    ;(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false
    renderWithServices(<NewMnemonic {...screenProps()} />, makeServices())

    tap(DEBUG_COPY_TAPS * 2)

    expect(copied()).toHaveLength(0)
  })
})
