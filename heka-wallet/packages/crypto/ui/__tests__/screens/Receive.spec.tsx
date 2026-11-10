import { fireEvent, screen } from '@testing-library/react-native'
import React from 'react'

import { Receive } from '../../src/screens/Receive'
import { makeServices, OTHER_MNEMONIC, OTHER_PAYMENT_0, renderWithServices, usdcOn } from '../helpers/services'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../helpers/mocks').i18nMock())
jest.mock('@react-native-clipboard/clipboard', () => require('../helpers/mocks').clipboardMock())

const USDC_ADDRESS = usdcOn('eip155:84532').address

const setup = async () => {
  const services = makeServices()
  await services.wallet.importPhrase(OTHER_MNEMONIC)
  renderWithServices(<Receive />, services)
}

const qrValue = () => screen.getByTestId('QRRenderer').props.children

describe('Receive', () => {
  it('shows the full address and an EIP-681 QR for the native asset with the chain id', async () => {
    await setup()

    expect(screen.getByTestId('CryptoAddress').props.children).toBe(OTHER_PAYMENT_0)
    expect(qrValue()).toBe(`ethereum:${OTHER_PAYMENT_0}@84532`)
  })

  it('puts the token contract in the QR when USDC is picked', async () => {
    await setup()

    fireEvent.press(screen.getByTestId('CryptoAsset-USDC'))

    expect(qrValue()).toBe(`ethereum:${USDC_ADDRESS}@84532/transfer?address=${OTHER_PAYMENT_0}`)
  })

  it('says there is no account before a seed exists', () => {
    renderWithServices(<Receive />, makeServices())

    expect(screen.getByText('Crypto.Home.NoAccount')).toBeTruthy()
  })
})
