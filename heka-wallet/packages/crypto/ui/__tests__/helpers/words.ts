import { screen, within } from '@testing-library/react-native'

/** The label of a WordChip ("3. wave"), found by its testID. */
export const wordAt = (testID: string): string => {
  const label = within(screen.getByTestId(testID)).getByText(/./).props.children
  return typeof label === 'string' ? label : String(label)
}
