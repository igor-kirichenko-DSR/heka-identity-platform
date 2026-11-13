import { buildCryptoConfig, CryptoConfigError, FALLBACK_CRYPTO_CHAIN } from '../../src/cryptoConfig'

const BASE_SEPOLIA = 'eip155:84532'
const RPC = 'CRYPTO_RPC_URL_BASE_SEPOLIA'
const BUNDLER = 'CRYPTO_BUNDLER_URL_BASE_SEPOLIA'

describe('buildCryptoConfig', () => {
  it('uses the fallback chain and no overrides when nothing is set', () => {
    const warn = jest.fn()
    expect(buildCryptoConfig({}, false, warn)).toEqual({ defaultChain: FALLBACK_CRYPTO_CHAIN, overrides: {} })
    expect(warn).not.toHaveBeenCalled()
  })

  it('treats empty values like missing ones', () => {
    expect(buildCryptoConfig({ CRYPTO_DEFAULT_CHAIN: '', [RPC]: '  ' }, false, jest.fn())).toEqual({
      defaultChain: FALLBACK_CRYPTO_CHAIN,
      overrides: {},
    })
  })

  it('takes a registered default chain', () => {
    expect(buildCryptoConfig({ CRYPTO_DEFAULT_CHAIN: BASE_SEPOLIA }, false, jest.fn()).defaultChain).toBe(BASE_SEPOLIA)
  })

  it('falls back with a warning when the default chain is not registered', () => {
    const warn = jest.fn()
    const config = buildCryptoConfig({ CRYPTO_DEFAULT_CHAIN: 'eip155:1' }, false, warn)
    expect(config.defaultChain).toBe(FALLBACK_CRYPTO_CHAIN)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('eip155:1'))
  })

  it('applies https overrides per chain', () => {
    const config = buildCryptoConfig(
      { [RPC]: 'https://rpc.example/key', [BUNDLER]: 'https://bundler.example' },
      false,
      jest.fn()
    )
    expect(config.overrides[BASE_SEPOLIA]).toEqual({
      rpcUrl: 'https://rpc.example/key',
      bundlerUrl: 'https://bundler.example',
    })
  })

  it('refuses an http override outside development', () => {
    expect(() => buildCryptoConfig({ [RPC]: 'http://rpc.example' }, false, jest.fn())).toThrow(CryptoConfigError)
  })

  it('refuses an unparsable override outside development', () => {
    expect(() => buildCryptoConfig({ [BUNDLER]: 'not a url' }, false, jest.fn())).toThrow(CryptoConfigError)
  })

  it('accepts an http override in development', () => {
    const config = buildCryptoConfig({ [RPC]: 'http://10.0.2.2:8545' }, true, jest.fn())
    expect(config.overrides[BASE_SEPOLIA]?.rpcUrl).toBe('http://10.0.2.2:8545')
  })

  it('ignores an unparsable override in development with a warning', () => {
    const warn = jest.fn()
    const config = buildCryptoConfig({ [RPC]: 'nope' }, true, warn)
    expect(config.overrides).toEqual({})
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(RPC))
  })

  it('refuses other schemes even in development', () => {
    const config = buildCryptoConfig({ [RPC]: 'ftp://rpc.example' }, true, jest.fn())
    expect(config.overrides).toEqual({})
  })

  it('registers Hedera testnet: default chain and an https relay override', () => {
    const HEDERA_TESTNET = 'eip155:296'
    const config = buildCryptoConfig(
      { CRYPTO_DEFAULT_CHAIN: HEDERA_TESTNET, CRYPTO_RPC_URL_HEDERA_TESTNET: 'https://relay.example/api' },
      false,
      jest.fn()
    )
    expect(config.defaultChain).toBe(HEDERA_TESTNET)
    expect(config.overrides[HEDERA_TESTNET]).toEqual({ rpcUrl: 'https://relay.example/api', bundlerUrl: undefined })
  })

  it('refuses a plain-http Hedera relay outside development', () => {
    expect(() =>
      buildCryptoConfig({ CRYPTO_RPC_URL_HEDERA_TESTNET: 'http://relay.example' }, false, jest.fn())
    ).toThrow(CryptoConfigError)
  })
})
