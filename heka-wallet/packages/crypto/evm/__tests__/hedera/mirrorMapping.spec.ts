import type { MirrorTransaction } from '../../src/hedera/mirrorTypes'
import type { AssetDescriptor } from '@heka-wallet/crypto-core'

import { longZeroAddress } from '../../src/hedera/entityId'
import { mapMirrorTransactions, type MirrorMappingContext } from '../../src/hedera/mirrorMapping'
import { MirrorNodeClient } from '../../src/hedera/MirrorNodeClient'

import transactions from '../fixtures/hedera/transactions-page-1.json'

const HOLDER_ID = '0.0.11338782'
const HOLDER_ADDRESS = '0x47341f3d96411012cCEBfad66DEb24e7718be038'
const ETH_HASH = `0x${'cd'.repeat(32)}`
const TOKEN_TX_MS = 1793970441000
const HBAR_SEND_MS = 1793970402000
const FAUCET_MS = 1793970326000
const TOKEN_CREATION_MS = 1793969997000

const HBAR: AssetDescriptor = {
  id: 'eip155:296/slip44:3030',
  symbol: 'HBAR',
  name: 'HBAR',
  decimals: 8,
  kind: 'native',
}
// The Spike B test token stands in for USDC in the recorded fixtures
const TOKEN: AssetDescriptor = {
  id: 'eip155:296/hts:0.0.11339492',
  symbol: 'TEST',
  name: 'Spike B test token',
  decimals: 6,
  kind: 'hts',
  address: longZeroAddress('0.0.11339492'),
}

const context = (
  resolve: MirrorMappingContext['resolveEthereumHash'] = async () => ETH_HASH
): MirrorMappingContext => ({
  chainId: 'eip155:296',
  holderAddress: HOLDER_ADDRESS,
  holderId: HOLDER_ID,
  nativeAsset: HBAR,
  tokens: [TOKEN],
  resolveEthereumHash: resolve,
})

const load = async (): Promise<MirrorTransaction[]> => {
  const client = new MirrorNodeClient({
    baseUrl: 'https://mirror.test',
    fetchFn: (async () => ({
      status: 200,
      ok: true,
      text: async () => JSON.stringify(transactions),
    })) as unknown as typeof fetch,
  })
  return (await client.getTransactions(HOLDER_ID)).items
}

describe('mapMirrorTransactions (recorded Hedera testnet page)', () => {
  it('merges a relay transfer and its token child into one record that carries the Ethereum hash', async () => {
    const records = await mapMirrorTransactions(await load(), context())

    const tokenOut = records.filter((r) => r.createdAt === TOKEN_TX_MS)
    expect(tokenOut).toHaveLength(1)
    expect(tokenOut[0]).toMatchObject({
      txId: ETH_HASH,
      explorerHash: ETH_HASH,
      direction: 'out',
      asset: TOKEN,
      amount: BigInt(10_000),
      counterparty: '0.0.11338924',
      fee: { asset: HBAR, amount: BigInt(4534764) },
      status: 'success',
      source: 'chain',
      account: HOLDER_ADDRESS,
    })
  })

  it('maps an HBAR send: value without the fee, the fee apart, the receiver as counterparty', async () => {
    const records = await mapMirrorTransactions(await load(), context())

    expect(records.find((r) => r.createdAt === HBAR_SEND_MS)).toMatchObject({
      direction: 'out',
      asset: HBAR,
      amount: BigInt(100_000_000),
      counterparty: '0.0.11338920',
      fee: { asset: HBAR, amount: BigInt(2583000) },
    })
  })

  it('maps an inbound faucet transfer without a fee, keyed by the Mirror Node transaction id', async () => {
    const records = await mapMirrorTransactions(await load(), context())

    const faucet = records.find((r) => r.createdAt === FAUCET_MS)
    expect(faucet).toMatchObject({
      direction: 'in',
      asset: HBAR,
      amount: BigInt(1_000_000_000),
      counterparty: '0.0.2',
      txId: '0.0.2-1793970322-673136510',
    })
    expect(faucet?.fee).toBeUndefined()
  })

  it('skips what the wallet does not show (token creation; transfers of an unlisted token)', async () => {
    const records = await mapMirrorTransactions(await load(), { ...context(), tokens: [] })

    expect(records.some((r) => r.createdAt === TOKEN_CREATION_MS)).toBe(false)
    expect(records.some((r) => r.asset.kind === 'hts')).toBe(false)
  })

  it('shows a failed relay transaction the holder paid for, with amount 0', async () => {
    const items = await load()
    const transactionId = items[1].transactionId
    const failed = items
      .filter((t) => t.transactionId === transactionId)
      .map((t) => ({ ...t, result: 'CONTRACT_REVERT_EXECUTED', tokenTransfers: [] }))

    const records = await mapMirrorTransactions(failed, context())

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ status: 'failed', amount: BigInt(0), asset: HBAR, direction: 'out' })
  })

  it('falls back to the Mirror Node transaction id when the Ethereum hash is not known', async () => {
    const records = await mapMirrorTransactions(
      await load(),
      context(async () => undefined)
    )

    expect(records.find((r) => r.createdAt === TOKEN_TX_MS)?.txId).toBe('0.0.7314364-1793970433-499143344')
  })

  it('returns nothing for an empty page', async () => {
    await expect(mapMirrorTransactions([], context())).resolves.toEqual([])
  })
})
