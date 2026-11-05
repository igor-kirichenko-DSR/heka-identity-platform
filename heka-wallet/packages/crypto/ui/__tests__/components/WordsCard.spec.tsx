import { screen } from '@testing-library/react-native'
import React from 'react'

import { WordsCard } from '../../src/components/WordsCard'
import { makeServices, renderWithServices } from '../helpers/services'

// The real testIdWithKey prefixes the key; a prefix applied twice breaks the Maestro selectors.
jest.mock('@bifold/core', () => ({
  ...require('../helpers/mocks').bifoldMock(),
  testIdWithKey: (key: string) => `id/${key}`,
}))
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())

describe('WordsCard', () => {
  it('prefixes the card and each word id exactly once', () => {
    renderWithServices(
      <WordsCard words={[{ value: 'wave' }, { value: 'wonder' }]} testKey="CryptoPhraseWord" />,
      makeServices()
    )

    expect(screen.getByTestId('id/CryptoPhraseWord')).toBeTruthy()
    expect(screen.getByTestId('id/CryptoPhraseWord-1')).toBeTruthy()
    expect(screen.getByTestId('id/CryptoPhraseWord-2')).toBeTruthy()
  })
})
