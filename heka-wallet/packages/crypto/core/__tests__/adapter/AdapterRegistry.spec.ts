import { AdapterRegistry, RegistryError } from '../../src'
import { BASE_SEPOLIA, HEDERA_TESTNET_EVM, makeChain } from '../helpers/chains'
import { FakeAdapter } from '../helpers/FakeAdapter'

describe('AdapterRegistry', () => {
  it('returns registered adapters by chain id and in registration order', () => {
    const registry = new AdapterRegistry()
    const base = new FakeAdapter(makeChain(BASE_SEPOLIA))
    const hedera = new FakeAdapter(makeChain(HEDERA_TESTNET_EVM))

    registry.register(base)
    registry.register(hedera)

    expect(registry.get(BASE_SEPOLIA)).toBe(base)
    expect(registry.has(HEDERA_TESTNET_EVM)).toBe(true)
    expect(registry.list()).toEqual([base, hedera])
  })

  it('rejects a second adapter for the same chain id', () => {
    const registry = new AdapterRegistry()
    registry.register(new FakeAdapter(makeChain(BASE_SEPOLIA)))

    expect(() => registry.register(new FakeAdapter(makeChain(BASE_SEPOLIA)))).toThrow(RegistryError)
  })

  it('rejects a disabled chain', () => {
    const registry = new AdapterRegistry()

    expect(() => registry.register(new FakeAdapter(makeChain('eip155:8453', { enabled: false })))).toThrow(
      RegistryError
    )
    expect(registry.list()).toEqual([])
  })

  it('throws for an unknown chain id', () => {
    expect(() => new AdapterRegistry().get(BASE_SEPOLIA)).toThrow(RegistryError)
  })
})
