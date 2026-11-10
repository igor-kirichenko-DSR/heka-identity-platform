import type { LocalAccount } from 'viem'

/** 'binding' is a separate derivation branch (F03). */
export type KeyPurpose = 'payment' | 'binding'

declare const authProofBrand: unique symbol

/** Produced only by the confirmation flow (fresh PIN or biometry); F03 defines how it is made and checked. */
export interface AuthProof {
  readonly [authProofBrand]: true
}

export interface KeyProvider {
  hasSeed(): Promise<boolean>
  /** Returns the mnemonic once, for the verify screen. */
  createSeed(words: 12 | 24): Promise<string>
  importSeed(mnemonic: string): Promise<void>
  /** The key lives only inside fn. */
  withAccount<T>(purpose: KeyPurpose, index: number, fn: (account: LocalAccount) => Promise<T>): Promise<T>
  revealMnemonic(auth: AuthProof): Promise<string>
}
