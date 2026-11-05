import type { CryptoScreens, CryptoStacks } from './routes'
import type { NavigatorScreenParams } from '@react-navigation/native'

/** Filled from a scanned EIP-681 URI; the amount is in the asset's smallest unit, as a decimal string. */
export interface SendPrefill {
  to?: string
  assetId?: string
  amount?: string
}

// The phrase never travels in route params: navigation state can be persisted and inspected.
export type CryptoRegisterStackParams = {
  [CryptoScreens.RegisterIntro]: undefined
  [CryptoScreens.NewMnemonic]: undefined
  [CryptoScreens.VerifyMnemonic]: undefined
  [CryptoScreens.ImportWallet]: undefined
  [CryptoScreens.RegisterDone]: undefined
}

export type CryptoMainStackParams = {
  [CryptoScreens.Home]: undefined
  [CryptoScreens.Receive]: undefined
  [CryptoScreens.Send]: { prefill?: SendPrefill } | undefined
  [CryptoScreens.ScanAddress]: undefined
  [CryptoScreens.History]: undefined
  [CryptoScreens.Settings]: undefined
  [CryptoScreens.RevealPhrase]: undefined
  [CryptoScreens.RemoveWallet]: undefined
}

export type CryptoStackParams = {
  [CryptoStacks.Register]: NavigatorScreenParams<CryptoRegisterStackParams> | undefined
  [CryptoStacks.Main]: NavigatorScreenParams<CryptoMainStackParams> | undefined
}
