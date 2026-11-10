import { fireEvent, screen } from '@testing-library/react-native'
import React from 'react'

import { CryptoScreens } from '../../../src/navigators/routes'
import { RegisterIntro } from '../../../src/screens/register/RegisterIntro'
import { VerifyMnemonicScreen } from '../../../src/screens/register/VerifyMnemonicScreen'
import { navigation, screenProps } from '../../helpers/navigation'
import { makeServices, renderWithServices } from '../../helpers/services'

jest.mock('@bifold/core', () => require('../../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../../helpers/mocks').i18nMock())

describe('RegisterIntro', () => {
  it('offers to create or import a wallet', () => {
    renderWithServices(<RegisterIntro {...screenProps()} />, makeServices())

    fireEvent.press(screen.getByTestId('CryptoCreateWallet'))
    fireEvent.press(screen.getByTestId('CryptoImportWallet'))

    expect(navigation.navigate).toHaveBeenCalledWith(CryptoScreens.NewMnemonic)
    expect(navigation.navigate).toHaveBeenCalledWith(CryptoScreens.ImportWallet)
  })
})

describe('VerifyMnemonicScreen', () => {
  it('starts over when no phrase is in memory', () => {
    renderWithServices(<VerifyMnemonicScreen {...screenProps()} />, makeServices())

    expect(navigation.replace).toHaveBeenCalledWith(CryptoScreens.NewMnemonic)
    expect(screen.queryByTestId('CryptoVerifyContinue')).toBeNull()
  })
})
