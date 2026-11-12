import { fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { Text } from 'react-native'

import { StepDots } from '../../src/components/StepDots'
import { RegisterFlowProvider, useRegisterFlow } from '../../src/navigators/RegisterFlowContext'
import { CryptoScreens } from '../../src/navigators/routes'

jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())

const ChooseImport: React.FC = () => {
  const { setKind } = useRegisterFlow()
  return (
    <Text testID="ChooseImport" onPress={() => setKind('import')}>
      import
    </Text>
  )
}

const dots = () => screen.getAllByTestId(/^RegisterStepDot-/)

describe('StepDots', () => {
  it('shows three dots for a new wallet and two once the holder chose to import', () => {
    render(
      <RegisterFlowProvider>
        <ChooseImport />
        <StepDots screen={CryptoScreens.RegisterDone} />
      </RegisterFlowProvider>
    )
    expect(dots()).toHaveLength(3)
    expect(screen.getByTestId('RegisterStepDot-2').props.accessibilityState.selected).toBe(true)

    fireEvent.press(screen.getByTestId('ChooseImport'))

    expect(dots()).toHaveLength(2)
    expect(screen.getByTestId('RegisterStepDot-1').props.accessibilityState.selected).toBe(true)
  })

  it('shows nothing on a screen without a step', () => {
    render(
      <RegisterFlowProvider>
        <StepDots screen={CryptoScreens.RegisterIntro} />
      </RegisterFlowProvider>
    )

    expect(screen.queryByTestId('RegisterStepDot-0')).toBeNull()
  })
})
