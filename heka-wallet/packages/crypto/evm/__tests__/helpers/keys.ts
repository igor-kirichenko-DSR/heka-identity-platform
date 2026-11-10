import type { AddressBook, ChainDescriptor, KeyProvider, KeyPurpose } from '@heka-wallet/crypto-core'
import type { Hex, LocalAccount, PrivateKeyAccount } from 'viem'

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

/** A random key per instance unless one is given (integration test); records every time the key is opened. */
export class FakeKeyProvider implements KeyProvider {
  readonly account: PrivateKeyAccount
  readonly opened: { purpose: KeyPurpose; index: number }[] = []

  constructor(privateKey: Hex = generatePrivateKey()) {
    this.account = privateKeyToAccount(privateKey)
  }

  hasSeed = jest.fn(async () => true)
  createSeed = jest.fn(async (): Promise<string> => {
    throw new Error('not used')
  })
  importSeed = jest.fn(async (): Promise<void> => {
    throw new Error('not used')
  })
  revealMnemonic = jest.fn(async (): Promise<string> => {
    throw new Error('not used')
  })

  async withAccount<T>(purpose: KeyPurpose, index: number, fn: (account: LocalAccount) => Promise<T>): Promise<T> {
    this.opened.push({ purpose, index })
    return fn(this.account)
  }
}

export const makeAddressBook = (address?: string): jest.Mocked<AddressBook> => ({
  getAddress: jest.fn(async (_chain: ChainDescriptor, _index: number) => address),
})
