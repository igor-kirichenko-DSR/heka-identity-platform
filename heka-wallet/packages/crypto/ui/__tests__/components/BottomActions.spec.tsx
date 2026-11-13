import { ButtonType } from '@bifold/core'
import { fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'

import { BottomActions } from '../../src/components/BottomActions'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())
jest.mock('@bifold/core/src/components/animated/ButtonLoading', () => require('../helpers/mocks').buttonLoadingMock())

describe('BottomActions', () => {
  it('renders every action and calls only the pressed one', () => {
    const onSend = jest.fn()
    const onReset = jest.fn()
    render(
      <BottomActions
        actions={[
          { title: 'Send', onPress: onSend, testID: 'send' },
          { title: 'Reset', onPress: onReset, type: ButtonType.Secondary, testID: 'reset' },
        ]}
      />
    )

    fireEvent.press(screen.getByTestId('reset'))

    expect(onReset).toHaveBeenCalledTimes(1)
    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not call a disabled action', () => {
    const onPress = jest.fn()
    render(<BottomActions actions={[{ title: 'Send', onPress, disabled: true, testID: 'send' }]} />)

    fireEvent.press(screen.getByTestId('send'))

    expect(onPress).not.toHaveBeenCalled()
  })

  it('shows the loading animation and blocks presses while loading', () => {
    const onPress = jest.fn()
    render(<BottomActions actions={[{ title: 'Send', onPress, isLoading: true, testID: 'send' }]} />)

    fireEvent.press(screen.getByTestId('send'))

    expect(screen.getByTestId('ButtonLoading')).toBeTruthy()
    expect(onPress).not.toHaveBeenCalled()
  })

  it('shows no loading animation otherwise', () => {
    render(<BottomActions actions={[{ title: 'Send', onPress: jest.fn(), testID: 'send' }]} />)

    expect(screen.queryByTestId('ButtonLoading')).toBeNull()
  })
})
