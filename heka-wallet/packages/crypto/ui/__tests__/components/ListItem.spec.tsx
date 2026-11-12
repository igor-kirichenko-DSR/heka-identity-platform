import { fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { Text } from 'react-native'

import { ListItem } from '../../src/components/ListItem'
import { ListSection } from '../../src/components/ListSection'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())

describe('ListItem', () => {
  it('shows icon, label, paragraph and the right slot', () => {
    render(<ListItem label="Base" paragraph="Default" icon="wallet" right={<Text>R</Text>} />)

    expect(screen.getByText('Base')).toBeTruthy()
    expect(screen.getByText('Default')).toBeTruthy()
    expect(screen.getByTestId('Icon-wallet')).toBeTruthy()
    expect(screen.getByText('R')).toBeTruthy()
  })

  it('reacts to a press only when it has onPress', () => {
    const onPress = jest.fn()
    const { rerender } = render(<ListItem label="Base" onPress={onPress} testID="row" />)

    fireEvent.press(screen.getByTestId('row'))
    expect(onPress).toHaveBeenCalledTimes(1)

    rerender(<ListItem label="Base" testID="row" />)
    fireEvent.press(screen.getByTestId('row'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

describe('ListSection', () => {
  it('shows the title and its rows', () => {
    render(
      <ListSection title="Network">
        <ListItem label="Base" />
      </ListSection>
    )

    expect(screen.getByText('Network')).toBeTruthy()
    expect(screen.getByText('Base')).toBeTruthy()
  })
})
