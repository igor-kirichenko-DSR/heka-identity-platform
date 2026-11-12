import type { ViewStyle } from 'react-native'

import { useGlobalStyles } from '@heka-wallet/shared'
import { useMemo } from 'react'

/**
 * The screen padding for a scroll view's contentContainerStyle. `defaultContainer` has `flex: 1`, which pins the content
 * to the height of the screen so it never scrolls; here it grows to fill the screen but can be taller.
 */
export const useScrollContent = (): ViewStyle => {
  const { defaultContainer } = useGlobalStyles()

  return useMemo(() => {
    const content: ViewStyle = { ...defaultContainer }
    delete content.flex
    return { ...content, flexGrow: 1 }
  }, [defaultContainer])
}
