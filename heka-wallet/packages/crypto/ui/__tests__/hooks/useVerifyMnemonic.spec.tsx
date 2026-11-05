import { act, renderHook } from '@testing-library/react-native'

import { useVerifyMnemonic } from '../../src/hooks/useVerifyMnemonic'
import { OTHER_MNEMONIC } from '../helpers/services'

jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())

// randomSort is the identity in the shared mock: the first four words are taken out, in phrase order.
const [first, second] = OTHER_MNEMONIC.split(' ')
const indexOf = (word: string, candidates: { word: string }[]) =>
  candidates.findIndex((candidate) => candidate.word === word)

describe('useVerifyMnemonic slots', () => {
  it('marks a word placed in the wrong slot as an error at once, and the right one not', () => {
    const { result } = renderHook(() => useVerifyMnemonic(OTHER_MNEMONIC))

    act(() => result.current.toggle(indexOf(second, result.current.candidates)))
    expect(result.current.slots[0].error).toBe(true)

    act(() => result.current.reset())
    act(() => result.current.toggle(indexOf(first, result.current.candidates)))
    expect(result.current.slots[0].error).toBe(false)
  })
})
