import { render, screen } from '@testing-library/react-native'
import React from 'react'
import { ScrollView } from 'react-native'

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
jest.mock('../../src/components/inputs', () => ({ PINInput: () => null, TextInput: () => null }))
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
})
