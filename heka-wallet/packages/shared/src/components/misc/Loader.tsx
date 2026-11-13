import React from 'react'
import { ActivityIndicator } from 'react-native'

import { useHekaTheme } from '../../theme'

const DEFAULT_LOADER_SIZE = 200

interface LoaderProps {
  size?: number
  testID?: string
}

/** The wallet's large loading spinner. */
export const Loader: React.FC<LoaderProps> = ({ size = DEFAULT_LOADER_SIZE, testID }) => {
  const { LoadingTheme } = useHekaTheme()

  return <ActivityIndicator size={size} color={LoadingTheme.indicatorColor} testID={testID} />
}
