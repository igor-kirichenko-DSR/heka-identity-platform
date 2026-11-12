import { fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'

import { CandidateWords } from '../../src/components/CandidateWords'
import { WordChip } from '../../src/components/WordChip'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())

describe('WordChip', () => {
  it('shows the position above the word', () => {
    render(<WordChip word="wave" position={3} columns={3} />)

    expect(screen.getByText('3.')).toBeTruthy()
    expect(screen.getByText('wave')).toBeTruthy()
  })

  it('is plain text, not a button', () => {
    render(<WordChip word="wave" position={1} columns={3} testID="chip" />)

    expect(screen.getByTestId('chip').props.accessibilityRole).toBe('text')
  })
})

describe('CandidateWords', () => {
  it('marks placed candidates and reports the pressed index', () => {
    const onPress = jest.fn()
    render(<CandidateWords candidates={[{ word: 'wave', slot: 0 }, { word: 'wonder' }]} onPress={onPress} />)

    fireEvent.press(screen.getByTestId('CryptoCandidate-wonder'))

    expect(onPress).toHaveBeenCalledWith(1)
    expect(screen.getByTestId('CryptoCandidate-wave').props.accessibilityState.selected).toBe(true)
    expect(screen.getByTestId('CryptoCandidate-wonder').props.accessibilityState.selected).toBe(false)
  })
})
