/**
 * Integration test against the real Base Sepolia. Off by default (DSRDSC-293, F02): it needs a funded account
 * and the network. Run: put CRYPTO_IT_PRIVATE_KEY=0x… in packages/crypto/evm/.env.it (gitignored), fund the
 * address with Base Sepolia ETH and at least 0.01 USDC, then
 *   CRYPTO_IT=1 yarn jest --selectProjects @heka-wallet/crypto-evm packages/crypto/evm/__tests__/integration
 */
import type { TxRecord } from '@heka-wallet/crypto-core'
import type { Hex } from 'viem'

import { existsSync } from 'fs'
import { join } from 'path'

import { createPublicClient, http } from 'viem'

import { baseSepolia, EvmAdapter } from '../../src'
import { OP_GAS_PRICE_ORACLE } from '../../src/chains/constants'
import { readL1Fee } from '../../src/l1Fee'
import { toViemChain } from '../../src/viemChain'
import { ETH, USDC } from '../helpers/chain'
import { FakeKeyProvider, makeAddressBook } from '../helpers/keys'
import { waitFor } from '../helpers/waitFor'

const ENV_FILE = join(__dirname, '..', '..', '.env.it')
const SEND_AMOUNT = BigInt(10_000) // 0.01 USDC
const RECEIPT_TIMEOUT_MS = 60_000
const HISTORY_TIMEOUT_MS = 60_000
const TEST_TIMEOUT_MS = 180_000

const enabled = process.env.CRYPTO_IT === '1'
// Skipped unless CRYPTO_IT=1: needs a funded testnet key and the network (DSRDSC-293, F02)
const describeIntegration = enabled ? describe : describe.skip

const loadPrivateKey = (): Hex => {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE)
  const key = process.env.CRYPTO_IT_PRIVATE_KEY
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(`CRYPTO_IT_PRIVATE_KEY missing or malformed (env or ${ENV_FILE})`)
  }
  return key as Hex
}

describeIntegration('EvmAdapter on Base Sepolia', () => {
  it(
    'reads balances, sends 0.01 USDC to itself, reaches success and finds it in history',
    async () => {
      const keys = new FakeKeyProvider(loadPrivateKey())
      const adapter = new EvmAdapter({ config: baseSepolia, addressBook: makeAddressBook(undefined) })
      const account = await adapter.deriveAccount(keys, 0)

      const balances = await adapter.getBalances(account, [ETH, USDC])
      expect(balances[ETH.id]).toBeGreaterThan(BigInt(0))
      expect(balances[USDC.id]).toBeGreaterThanOrEqual(SEND_AMOUNT)

      const request = {
        from: account,
        to: account.address,
        asset: USDC,
        amount: SEND_AMOUNT,
        feeMode: 'native' as const,
      }
      const quote = await adapter.estimateFee(request)
      expect(quote.warnings).toBeUndefined()

      const { txId } = await adapter.transfer(request, keys)

      const final = await waitFor(async () => {
        const { status } = await adapter.getStatus(txId)
        return status === 'pending' ? undefined : status
      }, RECEIPT_TIMEOUT_MS)
      expect(final).toBe('success')

      // Some public RPC nodes serve logs a moment after the receipt
      const record = await waitFor<TxRecord>(async () => {
        const page = await adapter.getHistory(account)
        return page.items.find((item) => item.txId.toLowerCase() === txId.toLowerCase())
      }, HISTORY_TIMEOUT_MS)
      expect(record).toMatchObject({ direction: 'self', asset: USDC, amount: SEND_AMOUNT, status: 'success' })
    },
    TEST_TIMEOUT_MS
  )
  it(
    'reads a positive L1 data fee from the real GasPriceOracle',
    async () => {
      const client = createPublicClient({
        chain: toViemChain(baseSepolia),
        transport: http(baseSepolia.descriptor.rpcUrl),
      })
      const l1Fee = await readL1Fee(client, OP_GAS_PRICE_ORACLE, {
        chainId: 84532,
        to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        value: BigInt(1),
        gas: BigInt(25_200),
        maxFeePerGas: BigInt(2_000_000),
        maxPriorityFeePerGas: BigInt(1_000_000),
      })

      expect(l1Fee).toBeGreaterThan(BigInt(0))
    },
    TEST_TIMEOUT_MS
  )
})
