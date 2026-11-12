import { useHekaTheme } from '@heka-wallet/shared'
import React from 'react'

import { REGISTER_ILLUSTRATION_HEIGHT, REGISTER_ILLUSTRATION_WIDTH } from '../constants'

/** The Heka logo, the picture of the register intro and end screens. */
export const RegisterIllustration: React.FC = () => {
  const { Assets } = useHekaTheme()

  return <Assets.svg.logo width={REGISTER_ILLUSTRATION_WIDTH} height={REGISTER_ILLUSTRATION_HEIGHT} />
}
