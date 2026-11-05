import { renderHook } from '@testing-library/react-native'

import { useHideOnBlur } from '../../src/hooks/useHideOnBlur'

const mockIsFocused = jest.fn<boolean, []>()
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockIsFocused() }))

describe('useHideOnBlur', () => {
  it('hides while the screen is not focused', () => {
    mockIsFocused.mockReturnValue(false)

    expect(renderHook(() => useHideOnBlur()).result.current).toBe(true)
  })

  it('shows while the screen is focused', () => {
    mockIsFocused.mockReturnValue(true)

    expect(renderHook(() => useHideOnBlur()).result.current).toBe(false)
  })
})
