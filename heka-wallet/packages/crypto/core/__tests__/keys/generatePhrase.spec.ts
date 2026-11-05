import { validateMnemonic } from '@scure/bip39'
import { english, generateMnemonic } from 'viem/accounts'

import { generatePhrase, PUBLIC_TEST_MNEMONICS, UnsupportedKeyError } from '../../src'
import { OTHER_MNEMONIC } from '../helpers/seeds'

jest.mock('viem/accounts', () => {
  const actual = jest.requireActual('viem/accounts')
  return { ...actual, generateMnemonic: jest.fn(actual.generateMnemonic) }
})

const generateMock = generateMnemonic as jest.MockedFunction<typeof generateMnemonic>

describe('generatePhrase', () => {
  it.each([12, 24] as const)('returns a valid %i-word phrase', (words) => {
    const phrase = generatePhrase(words)

    expect(phrase.split(' ')).toHaveLength(words)
    expect(validateMnemonic(phrase, english)).toBe(true)
  })

  it('draws again instead of returning a public test phrase', () => {
    generateMock.mockReturnValueOnce(PUBLIC_TEST_MNEMONICS[0]).mockReturnValueOnce(OTHER_MNEMONIC)

    expect(generatePhrase(12)).toBe(OTHER_MNEMONIC)
    expect(generateMock).toHaveBeenCalledTimes(2)
  })

  it('refuses a word count other than 12 or 24', () => {
    expect(() => generatePhrase(15 as 12)).toThrow(UnsupportedKeyError)
  })
})
