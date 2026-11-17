import type { UserOpBundler } from '../src'
import type { Address, Hex, Log } from 'viem'

import { ForeignDelegationError, PaymasterUnavailableError } from '@heka-wallet/crypto-core'
import { encodeAbiParameters, encodeEventTopics, erc20Abi, keccak256, pad, toHex } from 'viem'

import { baseSepolia, EvmAdapter, EvmAdapterError, type EvmChainConfig } from '../src'

import { accountOf, makeAdapter, RECIPIENT, transferRequest, USDC, USDC_ADDRESS } from './helpers/chain'
import { FakeKeyProvider, makeAddressBook } from './helpers/keys'
import { createRpcMock, hex, type RpcHandler } from './helpers/rpc'

const PAYMASTER: Address = '0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966'
const IMPLEMENTATION: Address = '0xe6Cae83BdE06E4c305530e199D7217f42808555B'
const FOREIGN: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const OP_HASH: Hex = keccak256(toHex('user operation'))
const BUNDLE_HASH: Hex = keccak256(toHex('bundle transaction'))
const MAX_FEE = BigInt(6_000_000)
const FEES = { maxFeePerGas: MAX_FEE, maxPriorityFeePerGas: BigInt(1) }
const CHAIN_ID = 84532

const delegationCode = (target: Address) => `0xef0100${target.slice(2).toLowerCase()}`

const NAME_SELECTOR = '0x06fdde03'
const VERSION_SELECTOR = '0x54fd4d50'
const NONCES_SELECTOR = '0x7ecebe00'

const handlers = (code = '0x'): Record<string, RpcHandler> => ({
  eth_chainId: () => hex(CHAIN_ID),
  eth_getCode: () => code,
  eth_getTransactionCount: () => hex(4),
  eth_getTransactionReceipt: () => null,
  eth_call: ([call]) => {
    const data = (call as { data: Hex }).data
    if (data.startsWith(NAME_SELECTOR)) return encodeAbiParameters([{ type: 'string' }], ['USDC'])
    if (data.startsWith(VERSION_SELECTOR)) return encodeAbiParameters([{ type: 'string' }], ['2'])
    if (data.startsWith(NONCES_SELECTOR)) return encodeAbiParameters([{ type: 'uint256' }], [BigInt(0)])
    throw new Error(`Unexpected call ${data}`)
  },
})

/** A Transfer log as the bundler client returns it: only what the fee read-back uses. */
const transferLog = (from: Address, to: Address, value: bigint): Log =>
  ({
    address: USDC_ADDRESS,
    topics: encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: { from, to } }),
    data: pad(toHex(value), { size: 32 }),
  }) as unknown as Log

const fakeBundler = (overrides: Partial<UserOpBundler> = {}): UserOpBundler => ({
  gasPrice: async () => FEES,
  send: async () => OP_HASH,
  receipt: async () => undefined,
  ...overrides,
})

const setup = (options: { code?: string; bundler?: Partial<UserOpBundler>; config?: EvmChainConfig } = {}) => {
  const keys = new FakeKeyProvider()
  const rpc = createRpcMock(handlers(options.code))
  // The send is a spy, so tests can read what the bundler was asked to submit
  const send = jest.fn<Promise<Hex>, Parameters<UserOpBundler['send']>>(options.bundler?.send ?? (async () => OP_HASH))
  const bundler = fakeBundler({ ...options.bundler, send })
  const adapter = new EvmAdapter({
    config: options.config ?? baseSepolia,
    addressBook: makeAddressBook(),
    transport: rpc.transport,
    bundler,
  })
  const from = accountOf(keys.account.address, 2)
  return { keys, rpc, send, adapter, from }
}

const adapterWith = (bundler: Partial<UserOpBundler>) =>
  new EvmAdapter({
    config: baseSepolia,
    addressBook: makeAddressBook(),
    transport: createRpcMock(handlers()).transport,
    bundler: fakeBundler(bundler),
  })

const usdcRequest = (from: ReturnType<typeof accountOf>, overrides = {}) =>
  transferRequest(from, { feeMode: 'usdc-paymaster', ...overrides })

describe('EvmAdapter paymaster mode: quote', () => {
  it('quotes in USDC with an estimate and an "up to" ceiling, without opening the key', async () => {
    const { adapter, from, keys } = setup()

    const quote = await adapter.estimateFee(usdcRequest(from))

    expect(quote).toMatchObject({ mode: 'usdc-paymaster', asset: USDC })
    expect(quote.amount).toBeGreaterThan(BigInt(0))
    expect(quote.max).toBeGreaterThan(quote.amount)
    expect(keys.opened).toEqual([])
  })

  it('quotes less once the account is delegated to the pinned implementation', async () => {
    const first = await setup().adapter.estimateFee(usdcRequest(setup().from))
    const { adapter, from } = setup({ code: delegationCode(IMPLEMENTATION) })
    const later = await adapter.estimateFee(usdcRequest(from))
    expect(later.amount).toBeLessThan(first.amount)
  })

  it('refuses a foreign 7702 delegation', async () => {
    const { adapter, from } = setup({ code: delegationCode(FOREIGN) })
    await expect(adapter.estimateFee(usdcRequest(from))).rejects.toBeInstanceOf(ForeignDelegationError)
  })

  it('reports the paymaster unavailable when the bundler gives no gas price', async () => {
    const { adapter, from } = setup({
      bundler: {
        gasPrice: jest.fn(async () => {
          throw new PaymasterUnavailableError('bundler down')
        }),
      },
    })
    await expect(adapter.estimateFee(usdcRequest(from))).rejects.toBeInstanceOf(PaymasterUnavailableError)
  })
})

describe('EvmAdapter paymaster mode: transfer', () => {
  it('sends one user operation and returns its hash; the plain path is not used', async () => {
    const { adapter, from, keys, send, rpc } = setup()

    const result = await adapter.transfer(usdcRequest(from), keys)

    expect(result).toEqual({ txId: OP_HASH })
    expect(send).toHaveBeenCalledTimes(1)
    const { simple, call } = send.mock.calls[0][0]
    expect(call.to).toBe(USDC_ADDRESS)
    expect(simple.authorization?.address.toLowerCase()).toBe(IMPLEMENTATION.toLowerCase())
    expect(simple.account.address).toBe(keys.account.address)
    expect(keys.opened).toEqual([{ purpose: 'payment', index: 2 }])
    expect(rpc.callsOf('eth_sendRawTransaction')).toEqual([])
  })

  it('sends no authorization when the account is already delegated to the pinned implementation', async () => {
    const { adapter, from, keys, send } = setup({ code: delegationCode(IMPLEMENTATION) })
    await adapter.transfer(usdcRequest(from), keys)
    expect(send.mock.calls[0][0].simple.authorization).toBeUndefined()
  })

  it('refuses a foreign delegation before the bundler sees anything', async () => {
    const { adapter, from, keys, send } = setup({ code: delegationCode(FOREIGN) })
    await expect(adapter.transfer(usdcRequest(from), keys)).rejects.toBeInstanceOf(ForeignDelegationError)
    expect(send).not.toHaveBeenCalled()
  })

  it('reports the paymaster unavailable when the bundler fails, and has sent nothing', async () => {
    const send = jest.fn(async () => {
      throw new Error('bundler down')
    })
    const { adapter, from, keys } = setup({ bundler: { send } })
    await expect(adapter.transfer(usdcRequest(from), keys)).rejects.toBeInstanceOf(PaymasterUnavailableError)
    await expect(adapter.getStatus(OP_HASH)).resolves.toEqual({ status: 'pending' })
  })

  it('keeps the bundler API key out of the error it raises (errors are logged)', async () => {
    const send = jest.fn(async () => {
      throw new Error('RPC failed. URL: https://api.pimlico.io/v2/84532/rpc?apikey=pim_secret123')
    })
    const { adapter, from, keys } = setup({ bundler: { send } })
    await expect(adapter.transfer(usdcRequest(from), keys)).rejects.toThrow(/apikey=\*\*\*/)
    await expect(adapter.transfer(usdcRequest(from), keys)).rejects.not.toThrow(/pim_secret123/)
  })

  it('refuses a permit ceiling above the fee cap', async () => {
    const operation = {
      callGasLimit: BigInt(60_000),
      verificationGasLimit: BigInt(150_000),
      preVerificationGas: BigInt(60_000),
      maxFeePerGas: MAX_FEE,
    }
    const send: UserOpBundler['send'] = async ({ paymaster }) => {
      await paymaster.getPaymasterData(operation)
      return OP_HASH
    }
    const { adapter, from, keys } = setup({ bundler: { send } })
    await expect(adapter.transfer(usdcRequest(from, { feeCap: BigInt(1) }), keys)).rejects.toBeInstanceOf(
      EvmAdapterError
    )
  })

  it('refuses a key that does not belong to the sender', async () => {
    const { adapter, keys, send } = setup()
    await expect(adapter.transfer(usdcRequest(accountOf(RECIPIENT, 2)), keys)).rejects.toThrow(
      /does not belong to the sender/
    )
    expect(send).not.toHaveBeenCalled()
  })
})

describe('EvmAdapter paymaster mode: status', () => {
  const settled = (success: boolean, sender: Address) => ({
    sender,
    success,
    actualGasCost: BigInt(1_209_461_550_000),
    transactionHash: BUNDLE_HASH,
    logs: [],
  })

  it('stays pending until the bundler has a receipt', async () => {
    const { adapter, from, keys } = setup()
    await adapter.transfer(usdcRequest(from), keys)
    await expect(adapter.getStatus(OP_HASH)).resolves.toEqual({ status: 'pending' })
  })

  it('on success gives the bundler transaction as explorer hash and the net USDC charged', async () => {
    const { keys, from } = setup()
    const receipt = jest.fn(async () => ({
      ...settled(true, keys.account.address),
      logs: [
        transferLog(keys.account.address, PAYMASTER, BigInt(9_030)),
        transferLog(PAYMASTER, keys.account.address, BigInt(4_984)),
        // The payment itself is not part of the fee
        transferLog(keys.account.address, RECIPIENT, BigInt(10_000)),
      ],
    }))
    const adapter = adapterWith({ receipt })
    await adapter.transfer(usdcRequest(from), keys)

    await expect(adapter.getStatus(OP_HASH)).resolves.toEqual({
      status: 'success',
      explorerHash: BUNDLE_HASH,
      fee: { asset: USDC, amount: BigInt(4_046) },
    })
  })

  it('quotes at the rate of the last receipt afterwards', async () => {
    const { keys, from } = setup()
    const receipt = jest.fn(async () => ({
      ...settled(true, keys.account.address),
      logs: [transferLog(keys.account.address, PAYMASTER, BigInt(9_000))],
    }))
    const adapter = adapterWith({ receipt })
    const before = await adapter.estimateFee(usdcRequest(from))
    await adapter.transfer(usdcRequest(from), keys)
    await adapter.getStatus(OP_HASH)
    const after = await adapter.estimateFee(usdcRequest(from))
    expect(after.amount).not.toBe(before.amount)
  })

  it('maps a reverted operation to failed', async () => {
    const { keys, from } = setup()
    const receipt = jest.fn(async () => settled(false, keys.account.address))
    const adapter = adapterWith({ receipt })
    await adapter.transfer(usdcRequest(from), keys)
    await expect(adapter.getStatus(OP_HASH)).resolves.toMatchObject({ status: 'failed', explorerHash: BUNDLE_HASH })
  })

  it('asks the bundler for a hash it did not send in this session, after the chain has no such transaction', async () => {
    const receipt = jest.fn(async () => settled(true, RECIPIENT))
    const { adapter, rpc } = setup({ bundler: { receipt } })
    await expect(adapter.getStatus(OP_HASH)).resolves.toMatchObject({ status: 'success' })
    expect(rpc.callsOf('eth_getTransactionReceipt')).toHaveLength(1)
    expect(receipt).toHaveBeenCalledWith(OP_HASH)
  })

  it('does not call the bundler for a plain transaction that has a receipt', async () => {
    const receipt = jest.fn()
    const rpc = createRpcMock({
      ...handlers(),
      eth_getTransactionReceipt: () => ({
        transactionHash: BUNDLE_HASH,
        blockHash: pad('0x1', { size: 32 }),
        blockNumber: '0x1',
        transactionIndex: '0x0',
        from: RECIPIENT,
        to: USDC_ADDRESS,
        cumulativeGasUsed: '0x5208',
        gasUsed: '0x5208',
        effectiveGasPrice: '0x1',
        contractAddress: null,
        logs: [],
        logsBloom: `0x${'00'.repeat(256)}`,
        status: '0x1',
        type: '0x2',
      }),
    })
    const adapter = new EvmAdapter({
      config: baseSepolia,
      addressBook: makeAddressBook(),
      transport: rpc.transport,
      bundler: fakeBundler({ receipt: receipt as UserOpBundler['receipt'] }),
    })
    await expect(adapter.getStatus(BUNDLE_HASH)).resolves.toMatchObject({ status: 'success' })
    expect(receipt).not.toHaveBeenCalled()
  })
})

describe('EvmAdapter fee modes', () => {
  const withoutPaymaster: EvmChainConfig = {
    ...baseSepolia,
    descriptor: { ...baseSepolia.descriptor, features: { ...baseSepolia.descriptor.features, paymaster: undefined } },
    aa: undefined,
  }

  it('refuses usdc-paymaster on a chain without a paymaster entry', async () => {
    const rpc = createRpcMock(handlers())
    const adapter = makeAdapter(rpc.transport, withoutPaymaster)
    const from = accountOf(RECIPIENT)
    await expect(adapter.estimateFee(usdcRequest(from))).rejects.toThrow(EvmAdapterError)
    await expect(adapter.transfer(usdcRequest(from), new FakeKeyProvider())).rejects.toThrow(EvmAdapterError)
    expect(rpc.calls).toEqual([])
  })

  it('offers the paymaster on Base Sepolia', () => {
    expect(baseSepolia.descriptor.features.paymaster).toMatchObject({ kind: 'circle', version: '0.8' })
    expect(baseSepolia.aa?.implementation).toBe(IMPLEMENTATION)
  })
})
