import React from 'react'

import WalletImage from '../../assets/wallet.svg'
import { REGISTER_ILLUSTRATION_HEIGHT, REGISTER_ILLUSTRATION_WIDTH } from '../constants'

/** The wallet picture of the register intro and end screens. */
export const RegisterIllustration: React.FC = () => (
  <WalletImage width={REGISTER_ILLUSTRATION_WIDTH} height={REGISTER_ILLUSTRATION_HEIGHT} />
)
