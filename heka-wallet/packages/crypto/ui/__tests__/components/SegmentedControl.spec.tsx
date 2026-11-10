import { fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'

import { SegmentedControl } from '../../src/components/SegmentedControl'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())

const OPTIONS = [
  { id: 'native', label: 'ETH', subLabel: '0.001 ETH' },
  { id: 'usdc', label: 'USDC' },
]

describe('SegmentedControl', () => {
  it('marks the selected segment and shows its sub-label', () => {
    render(<SegmentedControl options={OPTIONS} selectedId="native" onSelect={jest.fn()} testIdPrefix="Seg" />)

    expect(screen.getByTestId('Seg-ETH').props.accessibilityState.selected).toBe(true)
    expect(screen.getByTestId('Seg-USDC').props.accessibilityState.selected).toBe(false)
    expect(screen.getByText('0.001 ETH')).toBeTruthy()
  })

  it('reports the id of the pressed segment', () => {
    const onSelect = jest.fn()
    render(<SegmentedControl options={OPTIONS} selectedId="native" onSelect={onSelect} testIdPrefix="Seg" />)

    fireEvent.press(screen.getByTestId('Seg-USDC'))

    expect(onSelect).toHaveBeenCalledWith('usdc')
  })
})
