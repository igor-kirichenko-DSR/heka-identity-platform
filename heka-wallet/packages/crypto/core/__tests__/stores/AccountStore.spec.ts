import { AccountError, AccountStore, AdapterRegistry, type AddressBook, type ChainDescriptor } from '../../src'
import { BASE_SEPOLIA, HEDERA_TESTNET_EVM, makeChain } from '../helpers/chains'
import { FakeAdapter } from '../helpers/FakeAdapter'
import { makeLogger } from '../helpers/logger'
import { HOLDER } from '../helpers/records'

const setup = (addresses: Partial<Record<string, string>>) => {
  const registry = new AdapterRegistry()
  const base = new FakeAdapter(makeChain(BASE_SEPOLIA))
  const hedera = new FakeAdapter(makeChain(HEDERA_TESTNET_EVM))
  registry.register(base)
  registry.register(hedera)
  const addressBook: jest.Mocked<AddressBook> = {
    getAddress: jest.fn(async (chain: ChainDescriptor, _index: number) => addresses[chain.id]),
  }
  const logger = makeLogger()
  return { store: new AccountStore(registry, addressBook, logger), addressBook, base, hedera, logger }
}

describe('AccountStore', () => {
  it('loads the cached address of every registered chain at index 0 without deriving keys', async () => {
    const { store, addressBook, base, hedera } = setup({ [BASE_SEPOLIA]: HOLDER, [HEDERA_TESTNET_EVM]: HOLDER })

    await store.load()

    expect(addressBook.getAddress).toHaveBeenCalledWith(base.chain, 0)
    expect(addressBook.getAddress).toHaveBeenCalledWith(hedera.chain, 0)
    expect(base.deriveAccount).not.toHaveBeenCalled()
    expect(hedera.deriveAccount).not.toHaveBeenCalled()
    expect(store.currentAccount).toEqual({ chainId: BASE_SEPOLIA, address: HOLDER, index: 0 })
  })

  it('has no account for a chain without a cached address', async () => {
    const { store } = setup({ [BASE_SEPOLIA]: HOLDER })

    await store.load()

    expect(store.accountFor(HEDERA_TESTNET_EVM)).toBeUndefined()
  })

  it('switches the current chain', async () => {
    const { store } = setup({ [BASE_SEPOLIA]: HOLDER, [HEDERA_TESTNET_EVM]: HOLDER })
    await store.load()

    store.setChain(HEDERA_TESTNET_EVM)

    expect(store.currentAccount?.chainId).toBe(HEDERA_TESTNET_EVM)
  })

  it('refuses an unregistered chain', () => {
    const { store } = setup({})

    expect(() => store.setChain('eip155:1')).toThrow(AccountError)
  })

  it('keeps a failed address read in error state and logs it', async () => {
    const { store, addressBook, logger } = setup({})
    addressBook.getAddress.mockRejectedValueOnce(new Error('store locked'))

    await store.load()

    expect(store.error).toEqual(new Error('store locked'))
    expect(store.isLoading).toBe(false)
    expect(logger.error).toHaveBeenCalled()
  })
})
