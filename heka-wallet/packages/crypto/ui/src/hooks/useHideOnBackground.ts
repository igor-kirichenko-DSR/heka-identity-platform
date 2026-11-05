import { useEffect, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

// 'unknown' (start-up, iOS before the first event) is not a reason to hide.
const isAway = (state: AppStateStatus): boolean => state === 'background' || state === 'inactive'

/** True while the app is not in the foreground, so a secret is blanked before the OS takes its app-switcher shot. */
export const useHideOnBackground = (): boolean => {
  const [hidden, setHidden] = useState(() => isAway(AppState.currentState))

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setHidden(isAway(state)))
    return () => subscription.remove()
  }, [])

  return hidden
}
