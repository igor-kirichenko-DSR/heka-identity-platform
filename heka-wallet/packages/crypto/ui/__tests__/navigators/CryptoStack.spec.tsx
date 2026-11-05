import { act, fireEvent, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import React from 'react'

import { CryptoNavigator } from '../../src/navigators/CryptoNavigator'
import { CryptoStack } from '../../src/navigators/CryptoStack'
import { useRegisterFlow } from '../../src/navigators/RegisterFlowContext'
import { makeServices, OTHER_MNEMONIC, renderWithServices } from '../helpers/services'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../helpers/mocks').i18nMock())
jest.mock('@react-navigation/stack', () => require('../helpers/navigation').stackMock())
jest.mock('../../src/navigators/RegisterStack', () => {
  const { Text: MockText } = jest.requireActual('react-native')
  const { useRegisterFlow: useFlow } = jest.requireActual('../../src/navigators/RegisterFlowContext')
  const MockRegisterStack = () => {
    const { setFinishing } = useFlow()
    return (
      <MockText testID="RegisterStack" onPress={() => setFinishing(false)}>
        register
      </MockText>
    )
  }
  return { RegisterStack: MockRegisterStack }
})

jest.mock('../../src/navigators/MainStack', () => {
  const { Text: MockText } = jest.requireActual('react-native')
  return { MainStack: () => <MockText testID="MainStack">main</MockText> }
})

/** Puts the flow into "finishing" as a stored seed does. */
const FinishingProbe: React.FC = () => {
  const { setFinishing } = useRegisterFlow()
  return (
    <Text testID="StartFinishing" onPress={() => setFinishing(true)}>
      finish
    </Text>
  )
}

describe('CryptoNavigator', () => {
  it('shows a spinner until the wallet status is known', () => {
    renderWithServices(<CryptoNavigator />, makeServices())

    expect(screen.getByTestId('CryptoLoading')).toBeTruthy()
  })

  it('shows the register flow when there is no seed', async () => {
    const services = makeServices()
    await services.wallet.load()

    renderWithServices(<CryptoNavigator />, services)

    expect(screen.getByTestId('RegisterStack')).toBeTruthy()
  })

  it('shows the wallet when a seed exists', async () => {
    const services = makeServices()
    await services.wallet.importPhrase(OTHER_MNEMONIC)

    renderWithServices(<CryptoNavigator />, services)

    expect(screen.getByTestId('MainStack')).toBeTruthy()
  })

  it('keeps the register flow on screen after the seed is stored until Done is left', async () => {
    const services = makeServices()
    await services.wallet.load()
    renderWithServices(
      <>
        <FinishingProbe />
        <CryptoNavigator />
      </>,
      services
    )

    fireEvent.press(screen.getByTestId('StartFinishing'))
    await act(() => services.wallet.importPhrase(OTHER_MNEMONIC))
    expect(screen.getByTestId('RegisterStack')).toBeTruthy()

    fireEvent.press(screen.getByTestId('RegisterStack'))
    expect(screen.getByTestId('MainStack')).toBeTruthy()
  })

  it('offers a retry when the status cannot be read', async () => {
    const services = makeServices()
    const hasSeed = jest.spyOn(services.keys, 'hasSeed').mockRejectedValueOnce(new Error('store closed'))
    await services.wallet.load()
    renderWithServices(<CryptoNavigator />, services)

    await act(async () => fireEvent.press(screen.getByTestId('CryptoRetryLoad')))

    expect(hasSeed).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('RegisterStack')).toBeTruthy()
  })
})

describe('CryptoStack', () => {
  it('keeps its bottom clear for a host with a floating tab bar', () => {
    renderWithServices(<CryptoStack bottomInset={81} />, makeServices())

    expect(screen.getByTestId('CryptoStackContainer').props.style).toMatchObject({ paddingBottom: 81 })
  })
})
