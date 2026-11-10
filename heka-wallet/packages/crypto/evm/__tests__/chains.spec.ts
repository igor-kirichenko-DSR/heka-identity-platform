import { AdapterRegistry, eip155Reference, RegistryError } from '@heka-wallet/crypto-core'

import { baseMainnet, baseSepolia, evmChainId, EvmAdapterError, type EvmChainConfig } from '../src'
import { toViemChain } from '../src/viemChain'

import { makeAdapter } from './helpers/chain'
import { createRpcMock } from './helpers/rpc'

const consistent = (config: EvmChainConfig) => {
  const { descriptor } = config
  const chainId = descriptor.id
  expect(descriptor.kind).toBe('evm')
  expect(descriptor.nativeAsset.id).toBe(`${chainId}/slip44:60`)
  descriptor.assets.forEach((asset) => {
    expect(asset.kind).toBe('erc20')
    expect(asset.id).toBe(`${chainId}/erc20:${asset.address}`)
  })
  expect(config.logsMaxRange).toBeGreaterThan(0)
  expect(descriptor.features.historySource).toBe('rpc-logs')
}

describe('chain entries', () => {
  it('Base Sepolia is enabled with the agreed registry parameters', () => {
    consistent(baseSepolia)
    expect(evmChainId(baseSepolia)).toBe(84532)
    expect(baseSepolia.descriptor.enabled).toBe(true)
    expect(baseSepolia.descriptor.assets.map((asset) => [asset.symbol, asset.decimals, asset.address])).toEqual([
      ['USDC', 6, '0x036CbD53842c5426634e7929541eC2318f3dCF7e'],
    ])
    expect(baseSepolia.descriptor.explorer.tx('0xabc')).toBe('https://sepolia.basescan.org/tx/0xabc')
    expect(baseSepolia.descriptor.pendingTimeoutMs).toBe(120_000)
    expect(baseSepolia.descriptor.features.historyWindowBlocks).toBe(10_000)
    expect(baseSepolia.logsMaxRange).toBe(200)
    expect(baseSepolia.gasLimitCeiling).toBe(BigInt(150_000))
  })

  it('the Base mainnet twin ships disabled and the registry refuses it', () => {
    consistent(baseMainnet)
    expect(eip155Reference(baseMainnet.descriptor.id)).toBe(8453)
    expect(baseMainnet.descriptor.enabled).toBe(false)
    const adapter = makeAdapter(createRpcMock({}).transport, baseMainnet)
    expect(() => new AdapterRegistry().register(adapter)).toThrow(RegistryError)
  })

  it('Base Sepolia registers', () => {
    const registry = new AdapterRegistry()
    registry.register(makeAdapter(createRpcMock({}).transport))
    expect(registry.has('eip155:84532')).toBe(true)
  })
})

describe('toViemChain', () => {
  it('builds the viem chain from the entry, Multicall3 included', () => {
    const chain = toViemChain(baseSepolia)
    expect(chain.id).toBe(84532)
    expect(chain.nativeCurrency).toEqual({ name: 'Ether', symbol: 'ETH', decimals: 18 })
    expect(chain.rpcUrls.default.http).toEqual(['https://sepolia.base.org'])
    expect(chain.contracts?.multicall3?.address).toBe(baseSepolia.multicall3)
  })

  it('refuses an entry without an RPC URL', () => {
    const config = { ...baseSepolia, descriptor: { ...baseSepolia.descriptor, rpcUrl: undefined } }
    expect(() => toViemChain(config)).toThrow(EvmAdapterError)
  })

  it('refuses a non-EVM chain id', () => {
    const config = { ...baseSepolia, descriptor: { ...baseSepolia.descriptor, id: 'hedera:testnet' as const } }
    expect(() => evmChainId(config)).toThrow(EvmAdapterError)
  })
})
