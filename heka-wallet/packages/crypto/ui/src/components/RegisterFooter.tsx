import React from 'react'

import { type BottomAction, BottomActions } from './BottomActions'
import { StepDots } from './StepDots'

interface Props {
  /** The route name, which tells the dots where this screen is. */
  screen: string
  actions: BottomAction[]
}

/** The foot of a register screen: pinned buttons with the step dots above them. */
export const RegisterFooter: React.FC<Props> = ({ screen, actions }) => (
  <BottomActions actions={actions} above={<StepDots screen={screen} />} />
)
