import { act, render, screen } from '@testing-library/react-native'
import React from 'react'
import { Modal, ScrollView } from 'react-native'

import { ConfirmationInputModal, ConfirmationInputType } from '../../src/components/modals'

jest.mock('@bifold/core', () => ({
  Button: () => null,
  ButtonLocation: { Left: 0, Right: 1 },
  ButtonType: { Primary: 0, Secondary: 1 },
  IconButton: () => null,
  testIdWithKey: (key: string) => key,
}))
jest.mock('@bifold/core/src/components/animated/ButtonLoading', () => ({ __esModule: true, default: () => null }))
jest.mock('@bifold/core/src/constants', () => ({ minPINLength: 6 }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
const mockFocus = jest.fn()
jest.mock('../../src/components/inputs', () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual('react')
  const FocusableInput = forwardRef((_props: unknown, ref: React.Ref<{ focus: () => void }>) => {
    useImperativeHandle(ref, () => ({ focus: mockFocus }))
    return null
  })
  return { PINInput: FocusableInput, TextInput: FocusableInput }
})
jest.mock('../../src/components/misc', () => ({ Numpad: () => null }))
jest.mock('../../src/utils/platform', () => ({ platformBackIconConfig: { name: 'back' } }))
jest.mock('../../src/theme', () => {
  const theme = {
    TextTheme: { headingFour: {} },
    Spacing: { xxxl: 0, xl: 0, md: 0, xs: 0 },
    ColorPalette: { brand: { primaryBackground: '#fff' }, semantic: { error: '#f00' } },
  }
  return { useHekaTheme: () => theme, useGlobalStyles: () => ({ defaultContainer: {} }) }
})

describe('ConfirmationInputModal', () => {
  it('lets the first Numpad tap through while the PIN field is focused', () => {
    render(
      <ConfirmationInputModal
        title="Confirm"
        inputType={ConfirmationInputType.PIN}
        doneButtonTitle="Done"
        onConfirm={jest.fn().mockResolvedValue(undefined)}
        onCancel={jest.fn()}
      />
    )

    // With the default ('never') the scroll view spends the first tap on blurring the focused PIN field.
    expect(screen.UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled')
  })

  describe('focus on show', () => {
    const show = (inputType: ConfirmationInputType) => {
      jest.useFakeTimers()
      render(
        <ConfirmationInputModal
          title="Confirm"
          inputType={inputType}
          doneButtonTitle="Done"
          onConfirm={jest.fn().mockResolvedValue(undefined)}
          onCancel={jest.fn()}
        />
      )
      act(() => {
        screen.UNSAFE_getByType(Modal).props.onShow()
        jest.runAllTimers()
      })
      jest.useRealTimers()
    }

    it('does not focus the hidden PIN field, which would swallow the first Numpad tap', () => {
      show(ConfirmationInputType.PIN)

      expect(mockFocus).not.toHaveBeenCalled()
    })

    it('still focuses the password field so its keyboard opens', () => {
      show(ConfirmationInputType.Password)

      expect(mockFocus).toHaveBeenCalledTimes(1)
    })
  })
})
