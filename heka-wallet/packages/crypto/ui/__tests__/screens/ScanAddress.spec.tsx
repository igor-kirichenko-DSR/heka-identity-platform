import { act, fireEvent, screen } from '@testing-library/react-native'
import React from 'react'

import { CryptoScreens } from '../../src/navigators/routes'
import { ScanAddress } from '../../src/screens/ScanAddress'
import { scanValue } from '../helpers/mocks'
import { navigation } from '../helpers/navigation'
import { makeServices, OTHER_MNEMONIC, renderWithServices, usdcOn } from '../helpers/services'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../helpers/mocks').i18nMock())
jest.mock('@react-navigation/native', () => require('../helpers/navigation').nativeMock())

const RECIPIENT = '0x2222222222222222222222222222222222222222'
const usdc = usdcOn('eip155:84532')

const scan = async (value: string) => {
  const services = makeServices()
  await services.wallet.importPhrase(OTHER_MNEMONIC)
  renderWithServices(<ScanAddress />, services)
  scanValue.current = value
  await act(async () => fireEvent.press(screen.getByTestId('ScanCamera')))
  return services
}

describe('ScanAddress', () => {
  it('opens Send with recipient, token and amount from an EIP-681 request', async () => {
    await scan(`ethereum:${usdc.address}@84532/transfer?address=${RECIPIENT}&uint256=1500000`)

    expect(navigation.navigate).toHaveBeenCalledWith(CryptoScreens.Send, {
      prefill: { to: RECIPIENT, assetId: usdc.id, amount: '1500000' },
    })
  })

  it('opens Send with a bare address', async () => {
    await scan(RECIPIENT)

    expect(navigation.navigate).toHaveBeenCalledWith(CryptoScreens.Send, { prefill: { to: RECIPIENT } })
  })

  it('refuses a payment request for another chain', async () => {
    await scan(`ethereum:${RECIPIENT}@1?value=1`)

    expect(screen.getByText('Crypto.Scan.Unsupported')).toBeTruthy()
    expect(navigation.navigate).not.toHaveBeenCalled()
  })

  it('refuses a code that is not an address', async () => {
    const services = makeServices()
    services.adapters[0].validateAddress.mockReturnValue({ ok: false })
    await services.wallet.importPhrase(OTHER_MNEMONIC)
    renderWithServices(<ScanAddress />, services)
    scanValue.current = 'didcomm://invite'

    await act(async () => fireEvent.press(screen.getByTestId('ScanCamera')))

    expect(screen.getByText('Crypto.Scan.NotAnAddress')).toBeTruthy()
  })
})
