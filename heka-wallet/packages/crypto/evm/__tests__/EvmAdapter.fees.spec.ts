import { EvmAdapterError } from '../src'
import { withGasMargin } from '../src/fees'

import { accountOf, ETH, makeAdapter, RECIPIENT, transferRequest, USDC_ADDRESS } from './helpers/chain'
import { MAX_FEE, sendHandlers } from './helpers/handlers'
import { FakeKeyProvider } from './helpers/keys'
import { createRpcMock } from './helpers/rpc'

const holder = new FakeKeyProvider().account.address
const from = accountOf(holder)

describe('withGasMargin', () => {
  it.each([
    [21_000, 25_200],
    [62_147, 74_577], // 74 576.4 rounds up
    [1, 2],
    [0, 0],
  ])('%d gas → %d', (estimated, expected) => {
    expect(withGasMargin(BigInt(estimated))).toBe(BigInt(expected))
  })
})

describe('EvmAdapter.estimateFee', () => {
  it('quotes a native send as (gas × 1.2) × maxFeePerGas in ETH, without warnings', async () => {
    const rpc = createRpcMock(sendHandlers({ gas: BigInt(21_000) }))
    const quote = await makeAdapter(rpc.transport).estimateFee(
      transferRequest(from, { asset: ETH, amount: BigInt(10) ** BigInt(15) })
    )

    const expected = BigInt(25_200) * MAX_FEE
    expect(quote).toEqual({ mode: 'native', asset: ETH, amount: expected, display: '0.00000005544 ETH' })
    expect(rpc.callsOf('eth_estimateGas')[0].params[0]).toMatchObject({
      from: holder,
      to: RECIPIENT,
      value: '0x38d7ea4c68000',
    })
  })

  it('estimates an ERC-20 send as a transfer() call on the token contract', async () => {
    const rpc = createRpcMock(sendHandlers({ gas: BigInt(62_147) }))
    const quote = await makeAdapter(rpc.transport).estimateFee(transferRequest(from))

    expect(quote.amount).toBe(BigInt(74_577) * MAX_FEE)
    const call = rpc.callsOf('eth_estimateGas')[0].params[0] as Record<string, string>
    expect(call.to).toBe(USDC_ADDRESS)
    // transfer(address,uint256) selector, recipient, 10 000 units
    expect(call.data).toBe(
      '0xa9059cbb00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c80000000000000000000000000000000000000000000000000000000000002710'
    )
  })

  it('refuses when gas with margin is above the chain ceiling', async () => {
    const rpc = createRpcMock(sendHandlers({ gas: BigInt(130_000) })) // 156 000 > 150 000
    await expect(makeAdapter(rpc.transport).estimateFee(transferRequest(from))).rejects.toThrow(
      /above this chain's ceiling/
    )
  })

  it('accepts gas exactly at the ceiling', async () => {
    const rpc = createRpcMock(sendHandlers({ gas: BigInt(125_000) })) // × 1.2 = 150 000
    await expect(makeAdapter(rpc.transport).estimateFee(transferRequest(from))).resolves.toMatchObject({
      amount: BigInt(150_000) * MAX_FEE,
    })
  })

  it('warns when ETH cannot cover the fee of a USDC send', async () => {
    const fee = BigInt(74_577) * MAX_FEE
    const rpc = createRpcMock(sendHandlers({ gas: BigInt(62_147), balance: fee - BigInt(1) }))
    const quote = await makeAdapter(rpc.transport).estimateFee(transferRequest(from))
    expect(quote.warnings).toEqual(['insufficient-native-balance'])
  })

  it('does not warn when ETH covers the fee exactly', async () => {
    const fee = BigInt(74_577) * MAX_FEE
    const rpc = createRpcMock(sendHandlers({ gas: BigInt(62_147), balance: fee }))
    const quote = await makeAdapter(rpc.transport).estimateFee(transferRequest(from))
    expect(quote.warnings).toBeUndefined()
  })

  it('warns when ETH covers the fee but not amount + fee of a native send', async () => {
    const amount = BigInt(10) ** BigInt(15)
    const fee = BigInt(25_200) * MAX_FEE
    const rpc = createRpcMock(sendHandlers({ balance: amount + fee - BigInt(1) }))
    const quote = await makeAdapter(rpc.transport).estimateFee(transferRequest(from, { asset: ETH, amount }))
    expect(quote.warnings).toEqual(['insufficient-native-balance'])
  })

  it('refuses the usdc-paymaster fee mode until F08', async () => {
    const rpc = createRpcMock(sendHandlers())
    await expect(
      makeAdapter(rpc.transport).estimateFee(transferRequest(from, { feeMode: 'usdc-paymaster' }))
    ).rejects.toThrow(EvmAdapterError)
    expect(rpc.calls).toEqual([])
  })

  it.each([
    ['an invalid recipient', { to: '0x1234' }],
    ['the token contract as recipient', { to: USDC_ADDRESS }],
    ['a zero amount', { amount: BigInt(0) }],
    ['an asset of another chain', { asset: { ...ETH, id: 'eip155:1/slip44:60' } }],
    ['an account of another chain', { from: { ...from, chainId: 'eip155:1' as const } }],
  ])('refuses %s before any gas estimate', async (_name, overrides) => {
    const rpc = createRpcMock(sendHandlers())
    await expect(makeAdapter(rpc.transport).estimateFee(transferRequest(from, overrides))).rejects.toThrow(
      EvmAdapterError
    )
    expect(rpc.callsOf('eth_estimateGas')).toEqual([])
  })
})
