import { useIsFocused } from '@react-navigation/native'

/** True while the screen is not the focused one, e.g. under an iOS swipe-back peek. */
export const useHideOnBlur = (): boolean => !useIsFocused()
