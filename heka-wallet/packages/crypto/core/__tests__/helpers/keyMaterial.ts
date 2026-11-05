import type { Hex } from 'viem'

import { mnemonicToSeedSync } from '@scure/bip39'
import { bytesToHex, hexToBytes } from 'viem'
import { HDKey } from 'viem/accounts'

/** The secret forms a leak could take: text (phrase, hex) and bytes (BIP-39 seed, private keys). */
export interface KeyMaterial {
  texts: string[]
  bytes: Uint8Array[]
}

const privateKeyOf = (key: HDKey): Uint8Array => {
  if (!key.privateKey) throw new Error('HD key has no private key')
  return key.privateKey
}

export const mnemonicMaterial = (mnemonic: string): KeyMaterial => {
  const seed = mnemonicToSeedSync(mnemonic)
  const root = HDKey.fromMasterSeed(seed)
  const keys = [
    privateKeyOf(root),
    privateKeyOf(root.derive("m/44'/60'/0'/0/0")),
    privateKeyOf(root.derive("m/44'/60'/1'/0/0")),
  ]
  return {
    texts: [mnemonic, ...[seed, ...keys].map((bytes) => bytesToHex(bytes).slice(2))],
    bytes: [seed, ...keys],
  }
}

export const rawKeyMaterial = (key: Hex): KeyMaterial => ({ texts: [key.slice(2)], bytes: [hexToBytes(key)] })

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((byte, i) => byte === b[i])

/**
 * Walks everything reachable from root (fields, arrays, Map, Set, typed arrays) except `skip`, and names each
 * secret string, secret byte array, HDKey and listed object it finds.
 */
export const findKeyMaterial = (
  root: unknown,
  { material, skip = [], objects = [] }: { material: KeyMaterial; skip?: unknown[]; objects?: unknown[] }
): string[] => {
  const found: string[] = []
  const seen = new Set<unknown>(skip)
  const visit = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      const lower = value.toLowerCase()
      if (material.texts.some((text) => lower.includes(text.toLowerCase()))) found.push(`${path}: secret text`)
      return
    }
    if (typeof value !== 'object' || value === null || seen.has(value)) return
    seen.add(value)
    if (objects.includes(value)) found.push(`${path}: listed object`)
    if (value instanceof HDKey) found.push(`${path}: HDKey`)
    if (value instanceof Uint8Array) {
      if (material.bytes.some((bytes) => sameBytes(bytes, value))) found.push(`${path}: secret bytes`)
      return
    }
    if (value instanceof Map) value.forEach((item, key) => [key, item].forEach((entry) => visit(entry, `${path}<map>`)))
    else if (value instanceof Set) value.forEach((item) => visit(item, `${path}<set>`))
    else Object.entries(value).forEach(([key, item]) => visit(item, `${path}.${key}`))
  }
  visit(root, 'root')
  return found
}
