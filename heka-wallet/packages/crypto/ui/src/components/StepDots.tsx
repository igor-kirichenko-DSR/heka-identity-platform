import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { StyleSheet, View } from 'react-native'

import { STEP_DOT_ACTIVE_WIDTH, STEP_DOT_SIZE } from '../constants'
import { useRegisterFlow } from '../navigators/RegisterFlowContext'
import { registerStep } from '../navigators/registerSteps'

const useStyles = ({ Spacing, ColorPalette }: HekaTheme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.md },
    dot: {
      width: STEP_DOT_SIZE,
      height: STEP_DOT_SIZE,
      borderRadius: STEP_DOT_SIZE,
      backgroundColor: ColorPalette.grayscale.lightGrey,
    },
    active: { width: STEP_DOT_ACTIVE_WIDTH, backgroundColor: ColorPalette.brand.primary },
  })

interface Props {
  screen: string
}

/** The step dots of the register flow: the current step is a long dark dot. */
export const StepDots: React.FC<Props> = ({ screen }) => {
  const styles = useStyles(useHekaTheme())
  const { kind } = useRegisterFlow()
  const step = registerStep(screen, kind)
  if (!step) return null

  return (
    <View style={styles.row}>
      {Array.from({ length: step.stepsCount }, (_, index) => {
        const active = index === step.currentStepIndex
        return (
          <View
            key={index}
            style={[styles.dot, active && styles.active]}
            accessibilityState={{ selected: active }}
            testID={`RegisterStepDot-${index}`}
          />
        )
      })}
    </View>
  )
}
