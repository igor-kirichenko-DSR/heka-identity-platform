import type { KeyPurpose, SeedKind } from './KeyProvider'
import type { Hex, LocalAccount } from 'viem'

import { mnemonicToSeed, validateMnemonic } from '@scure/bip39'
import { english, HDKey, hdKeyToAccount, privateKeyToAccount } from 'viem/accounts'

import { InvalidSeedError, UnsupportedKeyError } from '../errors'

/** BIP-32 hardened indexes start here; a child index must stay below it. */
export const MAX_ACCOUNT_INDEX = 0x7fffffff

const BRANCH: Record<KeyPurpose, number> = { payment: 0, binding: 1 }

/** Payment `m/44'/60'/0'/0/{i}`, binding `m/44'/60'/1'/0/{i}`. */
export const derivationPath = (purpose: KeyPurpose, index: number): `m/44'/60'/${string}` => {
  assertAccountIndex(index)
  return `m/44'/60'/${BRANCH[purpose]}'/0/${index}`
}

export const assertAccountIndex = (index: number): void => {
  if (!Number.isInteger(index) || index < 0 || index > MAX_ACCOUNT_INDEX) {
    throw new UnsupportedKeyError(`Account index ${index} is not an integer in 0..${MAX_ACCOUNT_INDEX}`)
  }
}

/** Public phrases (BIP-39 vector, Hardhat / Anvil); anyone can drain them, so the wallet never stores one. */
export const PUBLIC_TEST_MNEMONICS: readonly string[] = [
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  'test test test test test test test test test test test junk',
]

/** Payment #0 addresses of PUBLIC_TEST_MNEMONICS, to refuse their keys as raw imports. */
const PUBLIC_TEST_ADDRESSES = new Set([
  '0x9858effd232b4033e47d90003d41ec34ecaeda94',
  '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
])

export const normalizeMnemonic = (input: string): string => input.trim().toLowerCase().split(/\s+/).join(' ')

/** Returns the normalised phrase; refuses unknown words, a bad checksum, a wrong length and public test phrases. */
export const parseMnemonic = (input: string): string => {
  const mnemonic = normalizeMnemonic(input)
  if (!validateMnemonic(mnemonic, english))
    throw new InvalidSeedError('The recovery phrase is not a valid BIP-39 phrase')
  if (PUBLIC_TEST_MNEMONICS.includes(mnemonic))
    throw new InvalidSeedError('The recovery phrase is a public test phrase')
  return mnemonic
}

const RAW_KEY_PATTERN = /^0x[0-9a-f]{64}$/

/** Returns the lower-case 0x key; refuses a malformed key, one outside the curve order and public test keys. */
export const parseRawKey = (input: string): Hex => {
  const key = input.trim().toLowerCase()
  if (!RAW_KEY_PATTERN.test(key)) throw new InvalidSeedError('The private key is not 0x-prefixed 32-byte hex')
  let address: string
  try {
    address = privateKeyToAccount(key as Hex).address
  } catch {
    // The curve library's message repeats the bound only; the key must not reach a log.
    throw new InvalidSeedError('The private key is outside the secp256k1 range')
  }
  if (PUBLIC_TEST_ADDRESSES.has(address.toLowerCase()))
    throw new InvalidSeedError('The private key is a public test key')
  return key as Hex
}

export interface SeedSecret {
  kind: SeedKind
  secret: string
}

export interface DerivationTarget {
  purpose: KeyPurpose
  index: number
}

/**
 * One account per target, from a single BIP-39 seed computation (async PBKDF2, so the JS thread keeps running).
 * A raw key has payment #0 only. The caller must drop the accounts after use.
 */
export const deriveLocalAccounts = async (seed: SeedSecret, targets: DerivationTarget[]): Promise<LocalAccount[]> => {
  const paths = targets.map(({ purpose, index }) => derivationPath(purpose, index))
  if (seed.kind === 'raw') {
    if (targets.some(({ purpose, index }) => purpose !== 'payment' || index !== 0)) {
      throw new UnsupportedKeyError('A raw-key wallet has payment account #0 only')
    }
    return targets.map(() => privateKeyToAccount(seed.secret as Hex))
  }
  const seedBytes = await mnemonicToSeed(seed.secret)
  const root = HDKey.fromMasterSeed(seedBytes)
  try {
    return paths.map((path) => hdKeyToAccount(root, { path }))
  } finally {
    // Best effort: JS gives no guarantee, but the master key and seed bytes need not outlive this call.
    root.wipePrivateData()
    seedBytes.fill(0)
  }
}

export const deriveLocalAccount = async (
  seed: SeedSecret,
  purpose: KeyPurpose,
  index: number
): Promise<LocalAccount> => {
  const [account] = await deriveLocalAccounts(seed, [{ purpose, index }])
  return account
}
