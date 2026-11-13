import { screen, within } from '@testing-library/react-native'

/** The text of a WordChip tile, position then word ("3. wave"), found by its testID. */
export const wordAt = (testID: string): string =>
  within(screen.getByTestId(testID))
    .getAllByText(/./)
    .map((node) => String(node.props.children))
    .join(' ')
