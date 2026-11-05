import type { LocalAccount } from 'viem'

/** 'binding' is a separate derivation branch (F03). */
export type KeyPurpose = 'payment' | 'binding'

/** A BIP-39 phrase, or one imported raw private key (payment index 0 only). */
export type SeedKind = 'mnemonic' | 'raw'

declare const authProofBrand: unique symbol

/** Produced only by the confirmation flow (fresh PIN or biometry) through an `AuthProofIssuer`; valid once. */
export interface AuthProof {
  readonly [authProofBrand]: true
}

/** Held only by the confirmation flow (crypto-ui `useAuthProof`); issue() after a successful PIN or biometry check. */
export interface AuthProofIssuer {
  issue(): AuthProof
}

export interface KeyProvider {
  readonly isLocked: boolean
  hasSeed(): Promise<boolean>
  seedKind(): Promise<SeedKind | undefined>
  /** Returns the mnemonic once, for the verify screen. */
  createSeed(words: 12 | 24): Promise<string>
  importSeed(mnemonic: string): Promise<void>
  /** 0x-prefixed 32-byte hex secp256k1 key. */
  importRawKey(privateKey: string): Promise<void>
  /** The key lives only inside fn. */
  withAccount<T>(purpose: KeyPurpose, index: number, fn: (account: LocalAccount) => Promise<T>): Promise<T>
  revealMnemonic(auth: AuthProof): Promise<string>
  /** Deletes the seed and the cached addresses only, never the identity wallet. */
  removeSeed(auth: AuthProof): Promise<void>
  /** Called by the UI on the identity wallet's lockout; rejects pending withAccount calls. */
  lock(): void
  unlock(): void
}
