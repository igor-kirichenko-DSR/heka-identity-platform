// Navigation mocks: a stack that renders its first screen, and a navigation object tests assert on.
import React from 'react'

interface ScreenProps {
  name: string
  component: React.ComponentType
}

const Screen: React.FC<ScreenProps> = () => null

/** Renders the component of the first Screen child, which is all a test of the screen choice needs. */
const Navigator: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const first = React.Children.toArray(children).find(React.isValidElement) as
    | React.ReactElement<ScreenProps>
    | undefined
  if (!first) return null
  const Component = first.props.component
  return <Component />
}

export const stackMock = () => ({
  __esModule: true,
  createStackNavigator: () => ({ Navigator, Screen }),
})

export const navigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  reset: jest.fn(),
  goBack: jest.fn(),
  setParams: jest.fn(),
}

export const nativeMock = () => ({
  __esModule: true,
  useNavigation: () => navigation,
  useIsFocused: () => true,
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react')
    useEffect(effect, [effect])
  },
})

/** Screen props for a component typed with StackScreenProps. */
export const screenProps = <P extends object | undefined = undefined>(params?: P) => ({
  navigation: navigation as never,
  route: { key: 'test', name: 'test', params } as never,
})
