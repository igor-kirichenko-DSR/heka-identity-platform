declare module '*.svg' {
  import { SvgProps } from 'react-native-svg'
  const content: React.FC<SvgProps>
  export default content
}

declare module 'react-native-argon2'

// React Native installs these globals (Libraries/Core/setUpTimers.js) but ships no types for them.
declare function requestIdleCallback(callback: () => void, options?: { timeout?: number }): number
declare function cancelIdleCallback(handle: number): void
