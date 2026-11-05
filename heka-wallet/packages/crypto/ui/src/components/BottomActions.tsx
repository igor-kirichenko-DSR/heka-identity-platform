import { Button, ButtonType } from '@bifold/core'
import ButtonLoading from '@bifold/core/src/components/animated/ButtonLoading'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { StyleSheet, View } from 'react-native'

const useStyles = ({ Spacing }: HekaTheme) =>
  StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end', gap: Spacing.sm, paddingVertical: Spacing.md },
  })

export interface BottomAction {
  title: string
  onPress: () => void
  /** Primary by default. */
  type?: ButtonType
  disabled?: boolean
  /** Shows the loading animation in the button and blocks presses. */
  isLoading?: boolean
  testID?: string
}

interface Props {
  actions: BottomAction[]
  /** Shown right above the buttons, e.g. step dots. */
  above?: React.ReactNode
}

/** The button or buttons pinned to the bottom of a screen. */
export const BottomActions: React.FC<Props> = ({ actions, above }) => {
  const styles = useStyles(useHekaTheme())

  return (
    <View style={styles.container}>
      {above}
      {actions.map((action) => (
        <Button
          key={action.title}
          title={action.title}
          accessibilityLabel={action.title}
          buttonType={action.type ?? ButtonType.Primary}
          onPress={action.onPress}
          disabled={action.disabled || action.isLoading}
          testID={action.testID}
        >
          {action.isLoading && <ButtonLoading />}
        </Button>
      ))}
    </View>
  )
}
