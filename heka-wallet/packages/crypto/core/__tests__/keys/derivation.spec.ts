import { mnemonicToSeedSync } from '@scure/bip39'
import { bytesToHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import {
  derivationPath,
  deriveLocalAccount,
  InvalidSeedError,
  MAX_ACCOUNT_INDEX,
  normalizeMnemonic,
  parseMnemonic,
  parseRawKey,
  UnsupportedKeyError,
} from '../../src'

import {
  ABANDON_MNEMONIC,
  ABANDON_PAYMENT_0,
  JUNK_BINDING_0,
  JUNK_BINDING_1,
  JUNK_MNEMONIC,
  JUNK_PAYMENT_0,
  JUNK_PAYMENT_0_KEY,
  JUNK_PAYMENT_1,
  OTHER_MNEMONIC,
  OTHER_RAW_KEY,
} from '../helpers/seeds'

// BIP-39 reference vector (trezor/python-mnemonic vectors.json, passphrase "TREZOR").
const ABANDON_TREZOR_SEED =
  '0xc55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04'

const SECP256K1_ORDER = '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'

const mnemonicSeed = (secret: string) => ({ kind: 'mnemonic' as const, secret })

describe('derivationPath', () => {
  it('puts payment keys on branch 0 and binding keys on branch 1', () => {
    expect(derivationPath('payment', 3)).toBe("m/44'/60'/0'/0/3")
    expect(derivationPath('binding', 3)).toBe("m/44'/60'/1'/0/3")
  })

  it.each([-1, 1.5, MAX_ACCOUNT_INDEX + 1, Number.NaN])('refuses index %p', (index) => {
    expect(() => derivationPath('payment', index)).toThrow(UnsupportedKeyError)
  })
})

describe('deriveLocalAccount', () => {
  it('derives the known payment addresses of the "test … junk" phrase', async () => {
    expect((await deriveLocalAccount(mnemonicSeed(JUNK_MNEMONIC), 'payment', 0)).address).toBe(JUNK_PAYMENT_0)
    expect((await deriveLocalAccount(mnemonicSeed(JUNK_MNEMONIC), 'payment', 1)).address).toBe(JUNK_PAYMENT_1)
  })

  it('derives the recorded binding addresses of the "test … junk" phrase', async () => {
    expect((await deriveLocalAccount(mnemonicSeed(JUNK_MNEMONIC), 'binding', 0)).address).toBe(JUNK_BINDING_0)
    expect((await deriveLocalAccount(mnemonicSeed(JUNK_MNEMONIC), 'binding', 1)).address).toBe(JUNK_BINDING_1)
  })

  it('derives the known payment #0 address of the "abandon … about" phrase', async () => {
    expect((await deriveLocalAccount(mnemonicSeed(ABANDON_MNEMONIC), 'payment', 0)).address).toBe(ABANDON_PAYMENT_0)
  })

  it('uses the BIP-39 seed of the reference vector', () => {
    expect(bytesToHex(mnemonicToSeedSync(ABANDON_MNEMONIC, 'TREZOR'))).toBe(ABANDON_TREZOR_SEED)
  })

  it('gives a raw key its own address at payment #0', async () => {
    const account = await deriveLocalAccount({ kind: 'raw', secret: OTHER_RAW_KEY }, 'payment', 0)

    expect(account.address).toBe(privateKeyToAccount(OTHER_RAW_KEY).address)
  })

  it.each([
    ['binding', 0],
    ['payment', 1],
  ] as const)('refuses %s #%i for a raw key', async (purpose, index) => {
    await expect(deriveLocalAccount({ kind: 'raw', secret: OTHER_RAW_KEY }, purpose, index)).rejects.toThrow(
      UnsupportedKeyError
    )
  })
})

describe('parseMnemonic', () => {
  it('normalises case and spacing and accepts a valid phrase', () => {
    const messy = `  ${OTHER_MNEMONIC.toUpperCase().split(' ').join('   ')}\n`

    expect(normalizeMnemonic(messy)).toBe(OTHER_MNEMONIC)
    expect(parseMnemonic(messy)).toBe(OTHER_MNEMONIC)
  })

  it('accepts a 24-word phrase', () => {
    const words24 = Array(23).fill('abandon').concat('art').join(' ')

    expect(parseMnemonic(words24)).toBe(words24)
  })

  it('refuses a phrase with an unknown word', () => {
    const words = OTHER_MNEMONIC.split(' ')
    words[4] = 'heka'

    expect(() => parseMnemonic(words.join(' '))).toThrow(InvalidSeedError)
  })

  it('refuses a phrase with a bad checksum', () => {
    const words = OTHER_MNEMONIC.split(' ')
    words[11] = words[11] === 'zoo' ? 'zone' : 'zoo'

    expect(() => parseMnemonic(words.join(' '))).toThrow(InvalidSeedError)
  })

  it('refuses a phrase of 13 words', () => {
    expect(() => parseMnemonic(`${OTHER_MNEMONIC} abandon`)).toThrow(InvalidSeedError)
  })

  it.each([ABANDON_MNEMONIC, JUNK_MNEMONIC])('refuses the public test phrase "%s"', (mnemonic) => {
    expect(() => parseMnemonic(mnemonic)).toThrow('public test phrase')
  })
})

describe('parseRawKey', () => {
  it('accepts a valid key and lower-cases it', () => {
    expect(parseRawKey(OTHER_RAW_KEY.toUpperCase().replace('0X', '0x'))).toBe(OTHER_RAW_KEY)
  })

  it.each([
    ['without 0x', OTHER_RAW_KEY.slice(2)],
    ['too short', OTHER_RAW_KEY.slice(0, -2)],
    ['not hex', `0x${'g'.repeat(64)}`],
    ['zero', `0x${'0'.repeat(64)}`],
    ['equal to the curve order', SECP256K1_ORDER],
  ])('refuses a key %s', (_case, key) => {
    expect(() => parseRawKey(key)).toThrow(InvalidSeedError)
  })

  it('never puts the key into the error message', () => {
    const bad = `0x${'1'.repeat(63)}g`

    expect(() => parseRawKey(bad)).toThrow(InvalidSeedError)
    expect(() => parseRawKey(bad)).not.toThrow('1'.repeat(16))
    expect(() => parseRawKey(SECP256K1_ORDER)).not.toThrow(SECP256K1_ORDER.slice(2, 18))
  })

  it('refuses the public test key of the "test … junk" phrase', () => {
    expect(() => parseRawKey(JUNK_PAYMENT_0_KEY)).toThrow('public test key')
  })
})
