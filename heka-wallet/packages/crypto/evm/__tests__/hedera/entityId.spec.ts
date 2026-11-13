import { EvmAdapterError } from '../../src'
import { entityIdOf, longZeroAddress } from '../../src/hedera/entityId'

describe('Hedera entity ids', () => {
  it('turns the USDC token id into its long-zero address (HashScan, Spike B)', () => {
    expect(longZeroAddress('0.0.429274')).toBe('0x0000000000000000000000000000000000068cda')
  })

  it('reads the entity id back from a long-zero address, in any case', () => {
    expect(entityIdOf('0x0000000000000000000000000000000000068cda')).toBe('0.0.429274')
    expect(entityIdOf('0x0000000000000000000000000000000000068CDA')).toBe('0.0.429274')
  })

  it('returns undefined for a regular EVM address', () => {
    expect(entityIdOf('0x47341f3d96411012cCEBfad66DEb24e7718be038')).toBeUndefined()
  })

  it('refuses a malformed id', () => {
    expect(() => longZeroAddress('429274')).toThrow(EvmAdapterError)
  })
})
