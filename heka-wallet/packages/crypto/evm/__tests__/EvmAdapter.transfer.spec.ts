import type { Hex, TransactionSerializedEIP1559 } from 'viem'

import { keccak256, parseTransaction, recoverTransactionAddress, serializeTransaction } from 'viem'

import { EvmAdapterError, withEvmAccount } from '../src'

import {
  accountOf,
  BASE_SEPOLIA_CHAIN_ID,
  ETH,
  makeAdapter,
  RECIPIENT,
  transferRequest,
  USDC_ADDRESS,
} from './helpers/chain'
import { L1_FEE, MAX_FEE, PENDING_NONCE, PRIORITY_FEE, sendHandlers } from './helpers/handlers'
import { FakeKeyProvider } from './helpers/keys'
import { createRpcMock } from './helpers/rpc'

const setup = (options: Parameters<typeof sendHandlers>[0] = {}) => {
  const keys = new FakeKeyProvider()
  const sent: Hex[] = []
  const rpc = createRpcMock(sendHandlers({ ...options, sent }))
  const from = accountOf(keys.account.address, 3)
  return { keys, sent, rpc, from, adapter: makeAdapter(rpc.transport) }
}

describe('EvmAdapter.transfer', () => {
  it('signs and submits a native send, returning the hash right after submission', async () => {
    const { keys, sent, rpc, from, adapter } = setup()
    const amount = BigInt(10) ** BigInt(15)

    const result = await adapter.transfer(transferRequest(from, { asset: ETH, amount }), keys)

    expect(sent).toHaveLength(1)
    expect(result).toEqual({ txId: keccak256(sent[0]) })
    expect(parseTransaction(sent[0])).toMatchObject({
      type: 'eip1559',
      chainId: BASE_SEPOLIA_CHAIN_ID,
      to: RECIPIENT.toLowerCase(),
      value: amount,
      nonce: PENDING_NONCE,
      gas: BigInt(25_200),
      maxFeePerGas: MAX_FEE,
      maxPriorityFeePerGas: PRIORITY_FEE,
    })
    expect(rpc.callsOf('eth_getTransactionCount')[0].params).toEqual([keys.account.address, 'pending'])
    expect(rpc.callsOf('eth_getTransactionReceipt')).toEqual([])
    expect(keys.opened).toEqual([{ purpose: 'payment', index: 3 }])
  })

  it('sends USDC as transfer(to, amount) on the token contract with no ETH value', async () => {
    const { keys, sent, from, adapter } = setup({ gas: BigInt(62_147) })

    await adapter.transfer(transferRequest(from, { amount: BigInt(10_000) }), keys)

    const tx = parseTransaction(sent[0])
    expect(tx.to).toBe(USDC_ADDRESS.toLowerCase())
    expect(tx.value).toBeUndefined()
    expect(tx.data).toBe(
      '0xa9059cbb00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c80000000000000000000000000000000000000000000000000000000000002710'
    )
  })

  it('pins the chain id in the signed payload, and the signature recovers to the sender', async () => {
    const { keys, sent, from, adapter } = setup()

    await adapter.transfer(transferRequest(from), keys)

    expect(parseTransaction(sent[0]).chainId).toBe(BASE_SEPOLIA_CHAIN_ID)
    await expect(
      recoverTransactionAddress({ serializedTransaction: sent[0] as TransactionSerializedEIP1559 })
    ).resolves.toBe(keys.account.address)
  })

  it('a payload signed for chain A does not verify as the sender on chain B (no replay)', async () => {
    const { keys, sent, from, adapter } = setup()
    await adapter.transfer(transferRequest(from), keys)

    const signed = parseTransaction(sent[0] as TransactionSerializedEIP1559)
    // Same fields and signature, only the chain id changed
    const onOtherChain = serializeTransaction(
      {
        type: 'eip1559',
        chainId: 296,
        to: signed.to,
        value: signed.value,
        data: signed.data,
        nonce: signed.nonce,
        gas: signed.gas,
        maxFeePerGas: signed.maxFeePerGas,
        maxPriorityFeePerGas: signed.maxPriorityFeePerGas,
      },
      { r: signed.r as Hex, s: signed.s as Hex, yParity: signed.yParity as number }
    )
    const recovered = await recoverTransactionAddress({
      serializedTransaction: onOtherChain as TransactionSerializedEIP1559,
    })
    expect(recovered).not.toBe(keys.account.address)
  })

  it('refuses when the RPC serves another chain, before opening the key', async () => {
    const { keys, sent, from, adapter } = setup({ chainId: 1 })

    await expect(adapter.transfer(transferRequest(from), keys)).rejects.toThrow(/RPC serves chain 1/)
    expect(keys.opened).toEqual([])
    expect(sent).toEqual([])
  })

  it('refuses when the key at the index does not belong to the sender', async () => {
    const { keys, sent, adapter } = setup()
    const from = accountOf(RECIPIENT, 3)

    await expect(adapter.transfer(transferRequest(from), keys)).rejects.toThrow(/does not belong to the sender/)
    expect(sent).toEqual([])
  })

  it('refuses when the fee is above the request fee cap', async () => {
    const { keys, sent, from, adapter } = setup()
    const fee = BigInt(25_200) * MAX_FEE

    await expect(
      adapter.transfer(transferRequest(from, { asset: ETH, feeCap: fee - BigInt(1) }), keys)
    ).rejects.toThrow(/above the cap/)
    expect(keys.opened).toEqual([])
    expect(sent).toEqual([])
  })

  it('counts the L1 data fee against the fee cap', async () => {
    const { keys, sent, from, adapter } = setup({ l1Fee: L1_FEE })
    const l2Fee = BigInt(25_200) * MAX_FEE

    // The L2 fee alone fits the cap; with the L1 fee the total does not
    await expect(adapter.transfer(transferRequest(from, { asset: ETH, feeCap: l2Fee }), keys)).rejects.toThrow(
      /above the cap/
    )
    expect(sent).toEqual([])
  })

  it('sends when the fee equals the cap', async () => {
    const { keys, sent, from, adapter } = setup()
    const fee = BigInt(25_200) * MAX_FEE

    await adapter.transfer(transferRequest(from, { asset: ETH, feeCap: fee }), keys)
    expect(sent).toHaveLength(1)
  })

  it('refuses the usdc-paymaster fee mode until F08', async () => {
    const { keys, rpc, from, adapter } = setup()
    await expect(adapter.transfer(transferRequest(from, { feeMode: 'usdc-paymaster' }), keys)).rejects.toThrow(
      EvmAdapterError
    )
    expect(rpc.calls).toEqual([])
  })
})

describe('withEvmAccount', () => {
  it('sets the chain id itself; a caller cannot override it', async () => {
    const keys = new FakeKeyProvider()
    // A caller holding a wider object cannot smuggle its own chain id in
    const withForeignChainId = { to: RECIPIENT, value: BigInt(1), nonce: 0, gas: BigInt(21_000), chainId: 1 }
    const serialized = await withEvmAccount(keys, 0, keys.account.address, BASE_SEPOLIA_CHAIN_ID, (signer) =>
      signer.signTransaction(withForeignChainId)
    )
    expect(parseTransaction(serialized).chainId).toBe(BASE_SEPOLIA_CHAIN_ID)
  })
})
