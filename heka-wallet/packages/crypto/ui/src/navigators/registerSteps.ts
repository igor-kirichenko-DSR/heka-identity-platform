import type { RegisterKind } from './RegisterFlowContext'

import { CryptoScreens } from './routes'

export interface RegisterStep {
  stepsCount: number
  currentStepIndex: number
}

const CREATE_SCREENS = [CryptoScreens.NewMnemonic, CryptoScreens.VerifyMnemonic, CryptoScreens.RegisterDone]
const IMPORT_SCREENS = [CryptoScreens.ImportWallet, CryptoScreens.RegisterDone]

/** Where a register screen sits in its flow: creating takes three steps, importing two. */
export const registerStep = (screen: string, kind: RegisterKind | undefined): RegisterStep | undefined => {
  // Import and the phrase screens name their flow themselves; only Done needs the remembered kind.
  const screens = screen === CryptoScreens.ImportWallet || kind === 'import' ? IMPORT_SCREENS : CREATE_SCREENS
  const currentStepIndex = screens.findIndex((name) => name === screen)
  return currentStepIndex < 0 ? undefined : { stepsCount: screens.length, currentStepIndex }
}
