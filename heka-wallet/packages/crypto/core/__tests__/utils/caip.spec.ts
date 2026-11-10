import { buildCaip10, eip155ChainId, eip155Reference, isChainId, parseCaip10, UriError } from '../../src'

const ADDRESS = '0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb'

describe('CAIP-2 / CAIP-10', () => {
  it('builds and parses an EVM account', () => {
    const id = buildCaip10('eip155:84532', ADDRESS)
    expect(id).toBe(`eip155:84532:${ADDRESS}`)
    expect(parseCaip10(id)).toEqual({ chainId: 'eip155:84532', address: ADDRESS })
  })

  it('builds and parses a Hedera account', () => {
    const id = buildCaip10('hedera:testnet', '0.0.12345')
    expect(id).toBe('hedera:testnet:0.0.12345')
    expect(parseCaip10(id)).toEqual({ chainId: 'hedera:testnet', address: '0.0.12345' })
  })

  it.each([
    ['too few parts', 'eip155:1'],
    ['too many parts', `eip155:1:${ADDRESS}:x`],
    ['an unsupported namespace', `cosmos:cosmoshub-3:${ADDRESS}`],
    ['an unsupported Hedera network', 'hedera:previewnet:0.0.1'],
    ['chain reference zero', `eip155:0:${ADDRESS}`],
    ['an invalid address character', 'eip155:1:0xab#'],
    ['an empty address', 'eip155:1:'],
  ])('rejects %s', (_case, value) => {
    expect(() => parseCaip10(value)).toThrow(UriError)
  })

  it('refuses to build with an invalid address', () => {
    expect(() => buildCaip10('eip155:1', 'not valid')).toThrow(UriError)
  })

  it('recognises supported chain ids', () => {
    expect(isChainId('eip155:84532')).toBe(true)
    expect(isChainId('hedera:mainnet')).toBe(true)
    expect(isChainId('eip155:01')).toBe(false)
    expect(isChainId('solana:mainnet')).toBe(false)
  })

  it('converts between EIP-155 numbers and chain ids', () => {
    expect(eip155ChainId(84532)).toBe('eip155:84532')
    expect(eip155Reference('eip155:84532')).toBe(84532)
    expect(eip155Reference('hedera:testnet')).toBeUndefined()
    expect(() => eip155ChainId(0)).toThrow(UriError)
  })
})
