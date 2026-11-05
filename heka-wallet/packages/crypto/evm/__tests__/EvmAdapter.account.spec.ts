import { baseSepolia, EvmAdapter } from '../src'

import { RECIPIENT } from './helpers/chain'
import { FakeKeyProvider, makeAddressBook } from './helpers/keys'
import { createRpcMock } from './helpers/rpc'

describe('EvmAdapter.deriveAccount', () => {
  it('returns the cached address, checksummed, without opening the key', async () => {
    const keys = new FakeKeyProvider()
    const addressBook = makeAddressBook(RECIPIENT.toLowerCase())
    const adapter = new EvmAdapter({ config: baseSepolia, addressBook, transport: createRpcMock({}).transport })

    await expect(adapter.deriveAccount(keys, 2)).resolves.toEqual({
      chainId: 'eip155:84532',
      address: RECIPIENT,
      index: 2,
    })
    expect(addressBook.getAddress).toHaveBeenCalledWith(baseSepolia.descriptor, 2)
    expect(keys.opened).toEqual([])
  })

  it('derives through the payment key on a cache miss', async () => {
    const keys = new FakeKeyProvider()
    const adapter = new EvmAdapter({
      config: baseSepolia,
      addressBook: makeAddressBook(undefined),
      transport: createRpcMock({}).transport,
    })

    await expect(adapter.deriveAccount(keys, 0)).resolves.toEqual({
      chainId: 'eip155:84532',
      address: keys.account.address,
      index: 0,
    })
    expect(keys.opened).toEqual([{ purpose: 'payment', index: 0 }])
  })
})
