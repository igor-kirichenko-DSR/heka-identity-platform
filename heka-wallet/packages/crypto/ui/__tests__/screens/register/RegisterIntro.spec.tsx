import { act, fireEvent, screen } from '@testing-library/react-native'
import React from 'react'

import { useRegisterFlow } from '../../../src/navigators/RegisterFlowContext'
import { CryptoScreens } from '../../../src/navigators/routes'
import { RegisterIntro } from '../../../src/screens/register/RegisterIntro'
import { VerifyMnemonicScreen } from '../../../src/screens/register/VerifyMnemonicScreen'
import { navigation, screenProps } from '../../helpers/navigation'
import { makeServices, OTHER_MNEMONIC, renderWithServices } from '../../helpers/services'

jest.mock('@bifold/core', () => require('../../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../../helpers/mocks').i18nMock())
jest.mock('@react-navigation/native', () => require('../../helpers/navigation').nativeMock())

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

  // The stored seed's Done screen clears the phrase while this screen is still animating out; it must not redirect.
  it('stays put when the phrase is cleared because the seed was stored', () => {
    const flow: { current?: ReturnType<typeof useRegisterFlow> } = {}
    const Probe: React.FC = () => {
      flow.current = useRegisterFlow()
      return null
    }
    renderWithServices(
      <>
        <Probe />
        <VerifyMnemonicScreen {...screenProps()} />
      </>,
      makeServices()
    )
    act(() => flow.current?.setPhrase(OTHER_MNEMONIC))
    navigation.replace.mockClear()

    act(() => {
      flow.current?.setFinishing(true)
      flow.current?.setPhrase(undefined)
    })

    expect(navigation.replace).not.toHaveBeenCalled()
  })
})
