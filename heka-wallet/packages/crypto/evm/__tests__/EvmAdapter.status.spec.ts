import { EvmAdapterError } from '../src'

import reverted from './fixtures/receipt-reverted.json'
import success from './fixtures/receipt-success.json'
import { ETH, makeAdapter } from './helpers/chain'
import { createRpcMock } from './helpers/rpc'

const TX_HASH = success.transactionHash

const statusWith = (receipt: unknown) => {
  const rpc = createRpcMock({ eth_getTransactionReceipt: () => receipt })
  return { rpc, status: makeAdapter(rpc.transport).getStatus(TX_HASH) }
}

describe('EvmAdapter.getStatus', () => {
  it('maps a successful receipt to success with the fee actually paid', async () => {
    const { rpc, status } = statusWith(success)
    await expect(status).resolves.toEqual({
      status: 'success',
      fee: { asset: ETH, amount: BigInt(success.gasUsed) * BigInt(success.effectiveGasPrice) },
    })
    expect(rpc.callsOf('eth_getTransactionReceipt')[0].params).toEqual([TX_HASH])
  })

  it('maps a reverted receipt to failed (the fee is still charged)', async () => {
    const { status } = statusWith(reverted)
    await expect(status).resolves.toEqual({
      status: 'failed',
      fee: { asset: ETH, amount: BigInt(reverted.gasUsed) * BigInt(reverted.effectiveGasPrice) },
    })
  })

  it('reports pending while the node has no receipt', async () => {
    const { status } = statusWith(null)
    await expect(status).resolves.toEqual({ status: 'pending' })
  })

  it('rethrows any other RPC failure instead of reporting pending', async () => {
    const rpc = createRpcMock({
      eth_getTransactionReceipt: () => {
        throw new Error('upstream unavailable')
      },
    })
    await expect(makeAdapter(rpc.transport).getStatus(TX_HASH)).rejects.toThrow(/upstream unavailable/)
  })

  it('refuses a txId that is not a transaction hash', async () => {
    const rpc = createRpcMock({})
    await expect(makeAdapter(rpc.transport).getStatus('0x1234')).rejects.toThrow(EvmAdapterError)
    expect(rpc.calls).toEqual([])
  })
})
