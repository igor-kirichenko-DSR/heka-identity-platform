import type { StackNavigationOptions } from '@react-navigation/stack'

import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'

const headerOptions = ({ ColorPalette, TextTheme }: HekaTheme, background?: string): StackNavigationOptions => ({
  headerTintColor: ColorPalette.brand.headerIcon,
  headerBackTitleVisible: false,
  // Same ground as the screen, no shadow or line: the title and icons float on the page.
  headerStyle: {
    backgroundColor: background ?? ColorPalette.brand.primaryBackground,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 0,
  },
  headerTitleAlign: 'left',
  headerTitleStyle: { ...TextTheme.headingThree, color: ColorPalette.brand.headerText },
})

/** The light header of the crypto stacks: flat, with a bold left-aligned title; page-coloured unless a ground is given. */
export const useLightHeader = (background?: string): StackNavigationOptions => headerOptions(useHekaTheme(), background)
