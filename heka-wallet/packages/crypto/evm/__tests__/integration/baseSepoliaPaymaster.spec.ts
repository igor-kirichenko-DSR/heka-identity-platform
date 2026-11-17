/**
 * Integration test of USDC fees on the real Base Sepolia (F08). Off by default: it needs an account with USDC and
 * ZERO ETH, the network and a bundler. Run: put CRYPTO_IT_ZERO_ETH_KEY=0x... in heka-wallet/.env.crypto-test-keys
 * (gitignored; template: .env.crypto-test-keys.example), optionally CRYPTO_IT_BUNDLER_URL for a keyed bundler, then
 *   CRYPTO_IT=1 yarn jest --selectProjects @heka-wallet/crypto-evm packages/crypto/evm/__tests__/integration/baseSepoliaPaymaster
 */
import type { Hex } from 'viem'

import { EvmAdapter } from '../../src'
import { baseSepolia } from '../../src/chains/baseSepolia'
import { ETH, USDC } from '../helpers/chain'
import { FakeKeyProvider, makeAddressBook } from '../helpers/keys'
import { ENV_FILE, loadTestKeysEnv } from '../helpers/testKeys'
import { waitFor } from '../helpers/waitFor'

const SEND_AMOUNT = BigInt(10_000) // 0.01 USDC
const RECEIPT_TIMEOUT_MS = 90_000
const TEST_TIMEOUT_MS = 240_000

const enabled = process.env.CRYPTO_IT === '1'
// Skipped unless CRYPTO_IT=1: needs a zero-ETH testnet account holding USDC and a bundler (DSRDSC-293, F08)
const describeIntegration = enabled ? describe : describe.skip

const loadPrivateKey = (): Hex => {
  loadTestKeysEnv()
  const key = process.env.CRYPTO_IT_ZERO_ETH_KEY
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(`CRYPTO_IT_ZERO_ETH_KEY missing or malformed (env or ${ENV_FILE})`)
  }
  return key as Hex
}

const configWithBundler = () => {
  const bundlerUrl = process.env.CRYPTO_IT_BUNDLER_URL
  const { paymaster } = baseSepolia.descriptor.features
  if (!bundlerUrl || !paymaster) return baseSepolia
  const features = { ...baseSepolia.descriptor.features, paymaster: { ...paymaster, bundlerUrl } }
  return { ...baseSepolia, descriptor: { ...baseSepolia.descriptor, features } }
}

describeIntegration('USDC fees on Base Sepolia', () => {
  it(
    'sends 0.01 USDC from an account with no ETH, paying the fee in USDC',
    async () => {
      const keys = new FakeKeyProvider(loadPrivateKey())
      const adapter = new EvmAdapter({ config: configWithBundler(), addressBook: makeAddressBook(undefined) })
      const account = await adapter.deriveAccount(keys, 0)

      const before = await adapter.getBalances(account, [ETH, USDC])
      expect(before[ETH.id]).toBe(BigInt(0))
      expect(before[USDC.id]).toBeGreaterThan(SEND_AMOUNT)

      const request = {
        from: account,
        to: account.address,
        asset: USDC,
        amount: SEND_AMOUNT,
        feeMode: 'usdc-paymaster' as const,
      }
      const quote = await adapter.estimateFee(request)
      expect(quote).toMatchObject({ mode: 'usdc-paymaster', asset: USDC })
      expect(quote.max).toBeGreaterThanOrEqual(quote.amount)

      const { txId } = await adapter.transfer(request, keys)

      const settled = await waitFor(async () => {
        const status = await adapter.getStatus(txId)
        return status.status === 'pending' ? undefined : status
      }, RECEIPT_TIMEOUT_MS)
      expect(settled.status).toBe('success')
      expect(settled.explorerHash).toMatch(/^0x[0-9a-fA-F]{64}$/)
      expect(settled.fee?.asset).toEqual(USDC)
      // The charge never exceeds the ceiling the holder was shown
      expect(settled.fee?.amount).toBeGreaterThan(BigInt(0))
      expect(settled.fee?.amount).toBeLessThanOrEqual(quote.max ?? quote.amount)

      const after = await adapter.getBalances(account, [ETH, USDC])
      expect(after[ETH.id]).toBe(BigInt(0))
    },
    TEST_TIMEOUT_MS
  )
})
