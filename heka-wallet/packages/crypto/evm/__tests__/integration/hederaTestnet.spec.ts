/**
 * Integration test against the real Hedera testnet (DSRDSC-293, F05). Off by default: it needs funded accounts, the
 * Hashio relay and the testnet Mirror Node. Put the keys in heka-wallet/.env.crypto-test-keys (gitignored; template: .env.crypto-test-keys.example):
 *   CRYPTO_IT_HEDERA_KEY=0x...            funded with at least 5 HBAR (the account is created by a transfer to its
 *                                         EVM address, e.g. from the portal faucet; the first send completes it)
 *   CRYPTO_IT_HEDERA_USDC=1               optional: the same account also holds 0.01+ USDC (0.0.429274)
 *   CRYPTO_IT_HEDERA_RESTRICTED_KEY=0x... optional: an account created with maxAutomaticTokenAssociations 0 and a
 *                                         little HBAR, USDC not associated (for the association test)
 * Run:
 *   CRYPTO_IT=1 yarn jest --selectProjects @heka-wallet/crypto-evm packages/crypto/evm/__tests__/integration/hederaTestnet
 */
import type { StatusResult } from '@heka-wallet/crypto-core'
import type { Hex } from 'viem'

import { generatePrivateKey } from 'viem/accounts'

import { HederaEvmAdapter, hederaTestnet } from '../../src'
import { FakeKeyProvider, makeAddressBook } from '../helpers/keys'
import { loadTestKeysEnv } from '../helpers/testKeys'
import { waitFor } from '../helpers/waitFor'

const HBAR = hederaTestnet.descriptor.nativeAsset
const USDC = hederaTestnet.descriptor.assets[0]
const ONE_HBAR = BigInt(100_000_000)
const USDC_AMOUNT = BigInt(10_000) // 0.01 USDC
// The relay answered in 7-73 s in Spike B
const FINAL_TIMEOUT_MS = 180_000
const MIRROR_TIMEOUT_MS = 60_000
const TEST_TIMEOUT_MS = 480_000

const enabled = process.env.CRYPTO_IT === '1'
const describeIntegration = enabled ? describe : describe.skip

const keyFrom = (name: string): Hex | undefined => {
  const value = process.env[name]
  if (!value) return undefined
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} is malformed`)
  return value as Hex
}

const makeAdapter = () => new HederaEvmAdapter({ config: hederaTestnet, addressBook: makeAddressBook(undefined) })

const untilFinal = (adapter: HederaEvmAdapter, txId: string) =>
  waitFor<StatusResult['status']>(async () => {
    const { status } = await adapter.getStatus(txId)
    return status === 'pending' ? undefined : status
  }, FINAL_TIMEOUT_MS)

describeIntegration('HederaEvmAdapter on Hedera testnet', () => {
  beforeAll(loadTestKeysEnv)

  it(
    'sends 1 HBAR to a fresh address: the receiver activates with a 0.0.x id and the send is final only on the Mirror Node',
    async () => {
      const key = keyFrom('CRYPTO_IT_HEDERA_KEY')
      if (!key) throw new Error('CRYPTO_IT_HEDERA_KEY is required')
      const adapter = makeAdapter()
      const sender = new FakeKeyProvider(key)
      const receiver = new FakeKeyProvider(generatePrivateKey())
      const from = await adapter.deriveAccount(sender, 0)
      const to = await adapter.deriveAccount(receiver, 0)
      expect(await adapter.activationState(to)).toBe('pending')

      const balances = await adapter.getBalances(from, [HBAR])
      expect(balances[HBAR.id]).toBeGreaterThan(ONE_HBAR * BigInt(2))

      const request = { from, to: to.address, asset: HBAR, amount: ONE_HBAR, feeMode: 'native' as const }
      const quote = await adapter.estimateFee(request)
      expect(quote.warnings).toBeUndefined()
      const { txId } = await adapter.transfer(request, sender)

      expect(await untilFinal(adapter, txId)).toBe('success')
      await waitFor(
        async () => ((await adapter.activationState(to)) === 'active' ? true : undefined),
        MIRROR_TIMEOUT_MS
      )
      expect(await adapter.getAccountId(to)).toMatch(/^0\.0\.\d+$/)
      expect((await adapter.getBalances(to, [HBAR]))[HBAR.id]).toBe(ONE_HBAR)

      const record = await waitFor(async () => {
        const page = await adapter.getHistory(from)
        return page.items.find((item) => item.txId.toLowerCase() === txId.toLowerCase())
      }, MIRROR_TIMEOUT_MS)
      expect(record).toMatchObject({ direction: 'out', asset: HBAR, amount: ONE_HBAR, status: 'success' })
    },
    TEST_TIMEOUT_MS
  )

  const describeUsdc = process.env.CRYPTO_IT_HEDERA_USDC === '1' ? it : it.skip
  describeUsdc(
    'sends 0.01 USDC to the funded account of a second key',
    async () => {
      const key = keyFrom('CRYPTO_IT_HEDERA_KEY')
      if (!key) throw new Error('CRYPTO_IT_HEDERA_KEY is required')
      const adapter = makeAdapter()
      const sender = new FakeKeyProvider(key)
      const from = await adapter.deriveAccount(sender, 0)
      const receiver = new FakeKeyProvider(generatePrivateKey())
      const to = await adapter.deriveAccount(receiver, 0)
      expect((await adapter.getBalances(from, [USDC]))[USDC.id]).toBeGreaterThanOrEqual(USDC_AMOUNT)

      // An unknown receiver is created by an HBAR transfer first (HIP-904 then lets it hold the token)
      const fund = { from, to: to.address, asset: HBAR, amount: ONE_HBAR, feeMode: 'native' as const }
      expect(await untilFinal(adapter, (await adapter.transfer(fund, sender)).txId)).toBe('success')

      const request = { from, to: to.address, asset: USDC, amount: USDC_AMOUNT, feeMode: 'native' as const }
      const { txId } = await adapter.transfer(request, sender)

      expect(await untilFinal(adapter, txId)).toBe('success')
      await waitFor(async () => {
        const balance = (await adapter.getBalances(to, [USDC]))[USDC.id]
        return balance === USDC_AMOUNT ? balance : undefined
      }, MIRROR_TIMEOUT_MS)
    },
    TEST_TIMEOUT_MS
  )

  const itRestricted = process.env.CRYPTO_IT_HEDERA_RESTRICTED_KEY ? it : it.skip
  itRestricted(
    'associates USDC on an account without automatic associations',
    async () => {
      const key = keyFrom('CRYPTO_IT_HEDERA_RESTRICTED_KEY')
      if (!key) throw new Error('CRYPTO_IT_HEDERA_RESTRICTED_KEY is required')
      const adapter = makeAdapter()
      const keys = new FakeKeyProvider(key)
      const account = await adapter.deriveAccount(keys, 0)
      expect(await adapter.isAssetEnabled(account, USDC)).toBe(false)

      const { txId } = await adapter.enableAsset(account, USDC, keys)

      expect(await untilFinal(adapter, txId)).toBe('success')
      expect(
        await waitFor(async () => ((await adapter.isAssetEnabled(account, USDC)) ? true : undefined), MIRROR_TIMEOUT_MS)
      ).toBe(true)
    },
    TEST_TIMEOUT_MS
  )
})
