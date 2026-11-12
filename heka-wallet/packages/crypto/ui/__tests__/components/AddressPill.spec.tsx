import Clipboard from '@react-native-clipboard/clipboard'
import { fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'

import { AddressCopy } from '../../src/components/AddressCopy'
import { AddressPill } from '../../src/components/AddressPill'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../helpers/mocks').i18nMock())
jest.mock('@react-native-clipboard/clipboard', () => require('../helpers/mocks').clipboardMock())

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'

describe('AddressPill', () => {
  it('shows the whole address and copies it', () => {
    render(<AddressPill address={ADDRESS} />)

    expect(screen.getByText(ADDRESS)).toBeTruthy()
    fireEvent.press(screen.getByTestId('CryptoCopyAddress'))

    expect(Clipboard.setString).toHaveBeenCalledWith(ADDRESS)
    expect(screen.getByText('Crypto.Address.Copied')).toBeTruthy()
  })
})

describe('AddressCopy', () => {
  it('shows the whole address and copies it', () => {
    render(<AddressCopy address={ADDRESS} />)

    expect(screen.getByTestId('CryptoAddress').props.children).toBe(ADDRESS)
    fireEvent.press(screen.getByTestId('CryptoCopyAddress'))

    expect(Clipboard.setString).toHaveBeenCalledWith(ADDRESS)
  })
})
