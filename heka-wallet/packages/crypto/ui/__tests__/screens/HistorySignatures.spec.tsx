import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import React from 'react'

import { History } from '../../src/screens/History'
import { BASE_SEPOLIA, makeServices, renderWithServices, type TestServices } from '../helpers/services'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../helpers/mocks').i18nMock())
jest.mock('@react-navigation/native', () => require('../helpers/navigation').nativeMock())

const T0 = Date.UTC(2026, 10, 13, 12, 0, 0)
const ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

describe('History - Signatures', () => {
  const started: TestServices[] = []
  afterEach(() => started.splice(0).forEach((services) => services.balances.dispose()))

  const setup = async () => {
    const services = makeServices()
    started.push(services)
    await services.signatures.put({
      id: 'old',
      origin: 'https://one.example.com',
      kind: 'personal_sign',
      chainId: BASE_SEPOLIA,
      branch: 'binding',
      address: ADDRESS,
      signedAt: T0,
    })
    await services.signatures.put({
      id: 'new',
      origin: 'https://two.example.com',
      kind: 'siwe',
      chainId: BASE_SEPOLIA,
      branch: 'payment',
      address: ADDRESS,
      signedAt: T0 + 1000,
    })
    renderWithServices(<History />, services)
    return services
  }

  it('shows payments first and the signatures under their own segment, newest first', async () => {
    await setup()
    expect(screen.queryByTestId('CryptoSignatureList')).toBeNull()

    act(() => {
      fireEvent.press(screen.getByTestId('CryptoHistoryTab-Crypto.History.Signatures'))
    })

    await waitFor(() => expect(screen.getByTestId('CryptoSignature-new')).toBeTruthy())
    expect(screen.getByText('https://one.example.com')).toBeTruthy()
    const rows = screen.getAllByTestId(/^CryptoSignature-/).map((row) => row.props.testID)
    expect(rows).toEqual(['CryptoSignature-new', 'CryptoSignature-old'])
  })

  it('says so when nothing was signed', async () => {
    const services = makeServices()
    started.push(services)
    renderWithServices(<History />, services)

    act(() => {
      fireEvent.press(screen.getByTestId('CryptoHistoryTab-Crypto.History.Signatures'))
    })

    expect(await screen.findByText('Crypto.History.SignaturesEmpty')).toBeTruthy()
  })
})
