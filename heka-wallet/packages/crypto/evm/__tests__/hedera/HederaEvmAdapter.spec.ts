import type { AssetDescriptor } from '@heka-wallet/crypto-core'
import type { Hex } from 'viem'

import { encodeFunctionData, erc20Abi, parseTransaction, parseAbi } from 'viem'

import { EvmAdapterError, HederaEvmAdapter, hederaTestnet, type EvmChainConfig, MirrorNodeClient } from '../../src'
import { longZeroAddress } from '../../src/hedera/entityId'
import { createRpcMock, hex, type RpcHandler } from '../helpers/rpc'
import { FakeKeyProvider, makeAddressBook } from '../helpers/keys'

import accountFixture from '../fixtures/hedera/account-active.json'
import failedResult from '../fixtures/hedera/contract-result-failed.json'
import successResult from '../fixtures/hedera/contract-result-success.json'
import transactionsFixture from '../fixtures/hedera/transactions-page-1.json'
import receiptFixture from '../fixtures/receipt-success.json'

const WEI = BigInt(10) ** BigInt(10)
const GAS_PRICE = BigInt('1300000000000')
const RECIPIENT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const TX_HASH = receiptFixture.transactionHash as Hex
const HOLDER_ID = '0.0.11338782'

// The Spike B test token (recorded fixtures) stands in for USDC
const TOKEN: AssetDescriptor = {
  id: 'eip155:296/hts:0.0.11339492',
  symbol: 'TEST',
  name: 'Spike B test token',
  decimals: 6,
  kind: 'hts',
  address: longZeroAddress('0.0.11339492'),
}
const config: EvmChainConfig = { ...hederaTestnet, descriptor: { ...hederaTestnet.descriptor, assets: [TOKEN] } }
const HBAR = config.descriptor.nativeAsset

interface Ledger {
  account: unknown | null
  contractResult: unknown | null
  requested: string[]
}

const makeLedger = (overrides: Partial<Ledger> = {}): Ledger => ({
  account: accountFixture,
  contractResult: successResult,
  requested: [],
  ...overrides,
})

const stubFetch = (ledger: Ledger): typeof fetch =>
  (async (url: string) => {
    ledger.requested.push(url)
    const route = (body: unknown | null) =>
      body === null
        ? { status: 404, ok: false, text: async () => '{}' }
        : { status: 200, ok: true, text: async () => JSON.stringify(body) }
    if (url.includes('/api/v1/accounts/')) return route(ledger.account)
    if (url.includes('/api/v1/transactions')) return route(transactionsFixture)
    if (url.includes('/api/v1/contracts/results/')) return route(ledger.contractResult)
    throw new Error(`unexpected Mirror Node request: ${url}`)
  }) as unknown as typeof fetch

const relayHandlers = (overrides: Record<string, RpcHandler> = {}): Record<string, RpcHandler> => ({
  eth_chainId: () => hex(296),
  eth_gasPrice: () => hex(GAS_PRICE),
  eth_estimateGas: () => hex(21_000),
  eth_getTransactionCount: () => hex(4),
  eth_sendRawTransaction: () => TX_HASH,
  ...overrides,
})

const setup = (ledgerOverrides: Partial<Ledger> = {}, handlers: Record<string, RpcHandler> = {}) => {
  const keys = new FakeKeyProvider()
  const ledger = makeLedger(ledgerOverrides)
  const sent: Hex[] = []
  const rpc = createRpcMock(
    relayHandlers({
      eth_sendRawTransaction: (params) => {
        sent.push(params[0] as Hex)
        return TX_HASH
      },
      ...handlers,
    })
  )
  const mirror = new MirrorNodeClient({
    baseUrl: 'https://mirror.test',
    fetchFn: stubFetch(ledger),
    sleep: async () => undefined,
  })
  const adapter = new HederaEvmAdapter({ config, addressBook: makeAddressBook(), transport: rpc.transport, mirror })
  const account = { chainId: config.descriptor.id, address: keys.account.address, index: 0 }
  return { keys, ledger, rpc, adapter, account, sent }
}

const request = (account: ReturnType<typeof setup>['account'], overrides = {}) => ({
  from: account,
  to: RECIPIENT,
  asset: HBAR,
  amount: BigInt(100_000_000),
  feeMode: 'native' as const,
  ...overrides,
})

const receiptWith = (overrides: Record<string, unknown> = {}) => ({
  ...receiptFixture,
  gasUsed: hex(36_868),
  effectiveGasPrice: hex(BigInt('1240000000000')),
  ...overrides,
})

describe('HederaEvmAdapter.getBalances', () => {
  it('reads HBAR in tinybar and the token balance exactly from the Mirror Node', async () => {
    const { adapter, account } = setup()

    await expect(adapter.getBalances(account, [HBAR, TOKEN])).resolves.toEqual({
      [HBAR.id]: BigInt(980375900),
      [TOKEN.id]: BigInt(999980000),
    })
  })

  it('reports zero for an account the ledger does not know yet', async () => {
    const { adapter, account } = setup({ account: null })

    await expect(adapter.getBalances(account, [HBAR, TOKEN])).resolves.toEqual({
      [HBAR.id]: BigInt(0),
      [TOKEN.id]: BigInt(0),
    })
  })

  it('refuses an asset that is not in the entry', async () => {
    const { adapter, account } = setup()

    await expect(adapter.getBalances(account, [{ ...TOKEN, id: 'eip155:296/hts:0.0.1' }])).rejects.toThrow(
      EvmAdapterError
    )
  })
})

describe('HederaEvmAdapter fee quote and transfer', () => {
  it('quotes in HBAR: gas x 1.2 at the relay price x 1.2, converted to tinybar and rounded up', async () => {
    const { adapter, account } = setup()

    const quote = await adapter.estimateFee(request(account))

    // 21 000 x 1.2 = 25 200 gas; x (1.3e12 x 1.2) weibar = 3.9312e16 weibar = 3 931 200 tinybar
    expect(quote).toMatchObject({ mode: 'native', asset: HBAR, amount: BigInt(3_931_200), display: '0.039312 HBAR' })
    expect(quote.warnings).toBeUndefined()
  })

  it('warns when the HBAR balance cannot cover the amount plus the fee (compared in tinybar)', async () => {
    const { adapter, account } = setup()

    const quote = await adapter.estimateFee(request(account, { amount: BigInt(980_000_000) }))

    expect(quote.warnings).toEqual(['insufficient-native-balance'])
  })

  it('sends HBAR with the value in weibar, the fee price from eth_gasPrice and no tip', async () => {
    const { adapter, account, keys, rpc, sent } = setup()

    const result = await adapter.transfer(request(account), keys)

    expect(result).toEqual({ txId: TX_HASH })
    expect(parseTransaction(sent[0])).toMatchObject({
      chainId: 296,
      to: RECIPIENT.toLowerCase(),
      value: BigInt(100_000_000) * WEI,
      gas: BigInt(25_200),
      maxFeePerGas: (GAS_PRICE * BigInt(12)) / BigInt(10),
    })
    expect(rpc.callsOf('eth_feeHistory')).toEqual([])
    expect(rpc.callsOf('eth_getBlockByNumber')).toEqual([])
  })

  it('sends an HTS token as transfer(to, amount) on the token address with no value', async () => {
    const { keys, account, adapter, sent } = setup({}, { eth_estimateGas: () => hex(36_868) })

    await adapter.transfer(request(account, { asset: TOKEN, amount: BigInt(10_000) }), keys)

    const tx = parseTransaction(sent[0])
    expect(tx.to).toBe(TOKEN.address)
    expect(tx.value).toBeUndefined()
    expect(tx.data).toBe(
      encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [RECIPIENT, BigInt(10_000)] })
    )
  })

  it('refuses a fee above the cap, compared in tinybar', async () => {
    const { adapter, account, keys } = setup()

    await expect(adapter.transfer(request(account, { feeCap: BigInt(3_931_199) }), keys)).rejects.toThrow(
      /above the cap/
    )
  })

  it('refuses the token address as a recipient', () => {
    const { adapter } = setup()

    expect(adapter.validateAddress(TOKEN.address as string).ok).toBe(false)
  })

  it('refuses a gas price that is not credible', async () => {
    const { adapter, account } = setup({}, { eth_gasPrice: () => hex(0) })

    await expect(adapter.estimateFee(request(account))).rejects.toThrow(EvmAdapterError)
  })

  it('scales a gas price the relay reports in tinybar', async () => {
    const { adapter, account } = setup({}, { eth_gasPrice: () => hex(130) })

    const quote = await adapter.estimateFee(request(account))

    expect(quote.amount).toBe(BigInt(3_931_200))
  })
})

describe('HederaEvmAdapter.getStatus (relay receipt x Mirror Node)', () => {
  const statusOf = async (receipt: unknown, contractResult: unknown | null) => {
    const { adapter } = setup({ contractResult }, { eth_getTransactionReceipt: () => receipt })
    return adapter.getStatus(TX_HASH)
  }

  it('is success only when both have it: the fee comes from the receipt in tinybar, rounded up', async () => {
    await expect(statusOf(receiptWith(), successResult)).resolves.toEqual({
      status: 'success',
      fee: { asset: HBAR, amount: BigInt(4_571_632) },
    })
  })

  it('stays pending while the Mirror Node does not have the transaction', async () => {
    await expect(statusOf(receiptWith(), null)).resolves.toEqual({ status: 'pending' })
  })

  it('is failed when the Mirror Node reports a failure although the relay says ok', async () => {
    await expect(statusOf(receiptWith(), failedResult)).resolves.toMatchObject({ status: 'failed' })
  })

  it('is failed when the relay reports a revert', async () => {
    await expect(statusOf(receiptWith({ status: '0x0' }), successResult)).resolves.toMatchObject({ status: 'failed' })
  })

  it('is pending with no relay receipt and no Mirror Node record', async () => {
    await expect(statusOf(null, null)).resolves.toEqual({ status: 'pending' })
  })

  it('is pending with a Mirror Node success but no relay receipt (both must agree)', async () => {
    await expect(statusOf(null, successResult)).resolves.toEqual({ status: 'pending' })
  })

  it('is failed when only the Mirror Node has the transaction and it failed', async () => {
    await expect(statusOf(null, failedResult)).resolves.toEqual({ status: 'failed' })
  })

  it('rejects an id that is not a transaction hash', async () => {
    const { adapter } = setup()

    await expect(adapter.getStatus('0.0.1-2-3')).rejects.toThrow(EvmAdapterError)
  })
})

describe('HederaEvmAdapter activation, account id and enabling', () => {
  it('is pending until the Mirror Node knows the account, then active with its 0.0.x id', async () => {
    const unknown = setup({ account: null })
    await expect(unknown.adapter.activationState(unknown.account)).resolves.toBe('pending')
    await expect(unknown.adapter.getAccountId(unknown.account)).resolves.toBeUndefined()

    const known = setup()
    await expect(known.adapter.activationState(known.account)).resolves.toBe('active')
    await expect(known.adapter.getAccountId(known.account)).resolves.toBe(HOLDER_ID)
  })

  it('treats HBAR, an account that takes any token (HIP-904) and a not-yet-created account as enabled', async () => {
    const auto = setup()
    await expect(auto.adapter.isAssetEnabled(auto.account, HBAR)).resolves.toBe(true)
    await expect(auto.adapter.isAssetEnabled(auto.account, TOKEN)).resolves.toBe(true)

    const fresh = setup({ account: null })
    await expect(fresh.adapter.isAssetEnabled(fresh.account, TOKEN)).resolves.toBe(true)
  })

  it('asks the HIP-719 facade when the account has no automatic associations and no record of the token', async () => {
    const restricted = { ...accountFixture, max_automatic_token_associations: 0, balance: { balance: 1, tokens: [] } }
    const yes = setup({ account: restricted }, { eth_call: () => `0x${'0'.repeat(63)}1` })
    await expect(yes.adapter.isAssetEnabled(yes.account, TOKEN)).resolves.toBe(true)

    const no = setup({ account: restricted }, { eth_call: () => `0x${'0'.repeat(64)}` })
    await expect(no.adapter.isAssetEnabled(no.account, TOKEN)).resolves.toBe(false)
    const call = no.rpc.callsOf('eth_call')[0].params[0] as { to: string; from: string }
    expect(call.to.toLowerCase()).toBe(TOKEN.address)
    expect(call.from.toLowerCase()).toBe(no.account.address.toLowerCase())
  })

  it('enables a token by sending associate() from the holder to the token address', async () => {
    const { keys, account, adapter, sent } = setup({}, { eth_estimateGas: () => hex(726_488) })

    await expect(adapter.enableAsset(account, TOKEN, keys)).resolves.toEqual({ txId: TX_HASH })

    const tx = parseTransaction(sent[0])
    expect(tx.to).toBe(TOKEN.address)
    expect(tx.data).toBe(
      encodeFunctionData({ abi: parseAbi(['function associate() returns (uint256)']), functionName: 'associate' })
    )
    // 726 488 x 1.2, rounded up
    expect(tx.gas).toBe(BigInt(871_786))
    expect(keys.opened).toEqual([{ purpose: 'payment', index: 0 }])
  })

  it('refuses to enable HBAR', async () => {
    const { adapter, account, keys } = setup()

    await expect(adapter.enableAsset(account, HBAR, keys)).rejects.toThrow(EvmAdapterError)
  })
})

describe('HederaEvmAdapter.getHistory', () => {
  it('maps a Mirror Node page and hands out its link as the cursor', async () => {
    const { adapter, account, ledger } = setup()

    const page = await adapter.getHistory(account)

    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.every((item) => item.source === 'chain' && item.chainId === 'eip155:296')).toBe(true)
    expect(page.next).toBe(transactionsFixture.links.next)
    expect(ledger.requested.some((url) => url.includes('account.id=0.0.11338782'))).toBe(true)
  })

  it('continues from the cursor', async () => {
    const { adapter, account, ledger } = setup()

    await adapter.getHistory(account, '/api/v1/transactions?account.id=0.0.11338782&timestamp=lt:1')

    expect(ledger.requested.some((url) => url.endsWith('timestamp=lt:1'))).toBe(true)
  })

  it('is empty for an account the ledger does not know', async () => {
    const { adapter, account } = setup({ account: null })

    await expect(adapter.getHistory(account)).resolves.toEqual({ items: [] })
  })
})

describe('hederaTestnet entry', () => {
  it('describes HBAR in tinybar, USDC as the HTS token at its long-zero address, and no paymaster', () => {
    const { descriptor } = hederaTestnet
    expect(descriptor.id).toBe('eip155:296')
    expect(descriptor.nativeAsset).toMatchObject({ symbol: 'HBAR', decimals: 8, kind: 'native' })
    expect(descriptor.assets).toEqual([
      expect.objectContaining({
        id: 'eip155:296/hts:0.0.429274',
        symbol: 'USDC',
        decimals: 6,
        kind: 'hts',
        address: '0x0000000000000000000000000000000000068cda',
      }),
    ])
    expect(descriptor.features).toMatchObject({ historySource: 'mirror-node', autoCreateOnReceive: true })
    expect(descriptor.features.paymaster).toBeUndefined()
    expect(descriptor.explorer.tx('0xabc')).toBe('https://hashscan.io/testnet/transaction/0xabc')
  })

  it('refuses to build an adapter without a Mirror Node URL', () => {
    const noMirror: EvmChainConfig = {
      ...hederaTestnet,
      descriptor: {
        ...hederaTestnet.descriptor,
        features: { historySource: 'mirror-node', autoCreateOnReceive: true },
      },
    }

    expect(() => new HederaEvmAdapter({ config: noMirror, addressBook: makeAddressBook() })).toThrow(EvmAdapterError)
  })
})
