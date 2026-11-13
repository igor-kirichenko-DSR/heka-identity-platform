import { render, screen } from '@testing-library/react-native'
import React from 'react'

import { TabStack } from '../../src/navigators/TabStack'

let mockCryptoEnabled = false

type ScreenProps = { options?: { tabBarTestID?: string } }

jest.mock('@bifold/core', () => ({
  __esModule: true,
  Screens: {},
  SettingStack: () => null,
  Stacks: {},
  TabStacks: { ConnectStack: 'ConnectStack', HomeStack: 'HomeStack' },
  testIdWithKey: (key: string) => key,
  TOKENS: { STACK_HOME: 'STACK_HOME', NOTIFICATIONS: 'NOTIFICATIONS' },
  useContainer: () => ({
    resolve: (token: string) => (token === 'NOTIFICATIONS' ? { useNotifications: () => [] } : () => null),
  }),
  useNetwork: () => ({ assertNetworkConnected: () => true }),
}))
jest.mock('@heka-wallet/shared', () => ({
  BootstrapIcon: () => null,
  useHekaTheme: () => ({
    ColorPalette: { brand: {}, grayscale: {} },
    TabTheme: { tabBarStyle: { height: 65 }, tabBarTextStyle: { fontSize: 10 }, tabBarContainerStyle: {} },
    IconSizes: {},
    Spacing: { md: 16 },
    TextTheme: {},
  }),
}))
jest.mock('@heka-wallet/crypto-ui', () => ({ CryptoStack: () => null }))
// The real navigator needs a NavigationContainer; each screen renders its tab testID instead.
jest.mock('@react-navigation/bottom-tabs', () => {
  // Required lazily: a mock factory may not reference imports.
  const { View } = jest.requireActual('react-native')
  return {
    BottomTabBar: () => null,
    createBottomTabNavigator: () => ({
      Navigator: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
      Screen: ({ options }: ScreenProps) => <View testID={options?.tabBarTestID} />,
    }),
  }
})
jest.mock('react-native-device-info', () => ({ isTablet: () => false }))
jest.mock('react-native-orientation-locker', () => ({
  OrientationType: { PORTRAIT: 'PORTRAIT' },
  useOrientationChange: jest.fn(),
}))
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('react-native-vector-icons/Ionicons', () => () => null)
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => () => null)
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('../../src/config', () => ({
  get isCryptoModuleEnabled() {
    return mockCryptoEnabled
  },
}))

describe('TabStack tabs', () => {
  it('shows three tabs with the crypto module off', () => {
    mockCryptoEnabled = false
    render(<TabStack />)

    expect(screen.getByTestId('TabCredentials')).toBeTruthy()
    expect(screen.getByTestId('TabScan')).toBeTruthy()
    expect(screen.getByTestId('TabSettings')).toBeTruthy()
    expect(screen.queryByTestId('TabPayments')).toBeNull()
  })

  it('adds the Payments tab and drops the Scan tab with the crypto module on', () => {
    mockCryptoEnabled = true
    render(<TabStack />)

    expect(screen.getByTestId('TabPayments')).toBeTruthy()
    expect(screen.getByTestId('TabCredentials')).toBeTruthy()
    expect(screen.getByTestId('TabSettings')).toBeTruthy()
    expect(screen.queryByTestId('TabScan')).toBeNull()
  })
})
