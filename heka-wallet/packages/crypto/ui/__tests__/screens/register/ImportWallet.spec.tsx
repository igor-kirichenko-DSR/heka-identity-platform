import { act, fireEvent, screen } from '@testing-library/react-native'
import React from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import { CryptoScreens } from '../../../src/navigators/routes'
import { ImportWallet } from '../../../src/screens/register/ImportWallet'
import { preventScreenCapture } from '../../helpers/mocks'
import { navigation } from '../../helpers/navigation'
import { makeServices, OTHER_MNEMONIC, OTHER_RAW_KEY, renderWithServices } from '../../helpers/services'

jest.mock('@bifold/core', () => require('../../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../../helpers/mocks').i18nMock())
jest.mock('@react-navigation/native', () => require('../../helpers/navigation').nativeMock())

const submit = async (value: string) => {
  fireEvent.changeText(screen.getByTestId('CryptoImportInput'), value)
  await act(async () => fireEvent.press(screen.getByTestId('CryptoImportSubmit')))
}

// Twelve dictionary words whose checksum does not match.
const BAD_CHECKSUM = OTHER_MNEMONIC.split(' ').slice(0, 11).concat('wave').join(' ')

describe('ImportWallet', () => {
  it.each([
    ['a word count BIP-39 does not have', 'wave wonder voice', 'Crypto.Import.Errors.WordCount'],
    ['a phrase with a bad checksum', BAD_CHECKSUM, 'Crypto.Import.Errors.InvalidPhrase'],
    ['a key that is not 32-byte hex', '0x1234', 'Crypto.Import.Errors.InvalidKey'],
  ])('refuses %s and stores nothing', async (_case, input, error) => {
    const services = makeServices()
    renderWithServices(<ImportWallet />, services)

    await submit(input)

    expect(screen.getByText(error)).toBeTruthy()
    expect(await services.keys.hasSeed()).toBe(false)
  })

  it('imports a recovery phrase and shows Done', async () => {
    const services = makeServices()
    renderWithServices(<ImportWallet />, services)

    await submit(` ${OTHER_MNEMONIC.toUpperCase()} `)

    expect(services.wallet.status).toBe('mnemonic')
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: CryptoScreens.RegisterDone }] })
  })

  it('imports a raw private key', async () => {
    const services = makeServices()
    renderWithServices(<ImportWallet />, services)

    await submit(OTHER_RAW_KEY)

    expect(services.wallet.status).toBe('raw')
  })

  it('cannot submit an empty input', () => {
    renderWithServices(<ImportWallet />, makeServices())

    expect(screen.getByTestId('CryptoImportSubmit')).toBeDisabled()
  })

  it('clears the error when the input changes', async () => {
    renderWithServices(<ImportWallet />, makeServices())
    await submit('0x1234')

    fireEvent.changeText(screen.getByTestId('CryptoImportInput'), '0x12345')

    expect(screen.queryByText('Crypto.Import.Errors.InvalidKey')).toBeNull()
  })

  it('blocks screen capture of the pasted secret', () => {
    renderWithServices(<ImportWallet />, makeServices())

    expect(preventScreenCapture).toHaveBeenCalled()
  })

  it('blanks the pasted secret while the app is in the background', () => {
    let onChange: (state: AppStateStatus) => void = () => undefined
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      onChange = listener as (state: AppStateStatus) => void
      return { remove: jest.fn() } as never
    })
    renderWithServices(<ImportWallet />, makeServices())
    fireEvent.changeText(screen.getByTestId('CryptoImportInput'), OTHER_RAW_KEY)

    act(() => onChange('inactive'))
    expect(screen.getByTestId('CryptoImportInput').props.value).toBe('')

    act(() => onChange('active'))
    expect(screen.getByTestId('CryptoImportInput').props.value).toBe(OTHER_RAW_KEY)
  })
})
