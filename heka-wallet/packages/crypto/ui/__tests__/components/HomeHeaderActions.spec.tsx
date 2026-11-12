import { fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'

import { HomeHeaderActions } from '../../src/components/HomeHeaderActions'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../helpers/mocks').i18nMock())

describe('HomeHeaderActions', () => {
  it('opens History and Settings', () => {
    const onHistory = jest.fn()
    const onSettings = jest.fn()
    render(<HomeHeaderActions onHistory={onHistory} onSettings={onSettings} />)

    fireEvent.press(screen.getByTestId('CryptoHistory'))
    fireEvent.press(screen.getByTestId('CryptoSettings'))

    expect(onHistory).toHaveBeenCalledTimes(1)
    expect(onSettings).toHaveBeenCalledTimes(1)
  })
})
