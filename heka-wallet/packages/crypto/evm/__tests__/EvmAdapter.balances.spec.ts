import type { Hex } from 'viem'

import { decodeFunctionData, encodeFunctionResult, erc20Abi, multicall3Abi } from 'viem'

import { baseSepolia, EvmAdapterError } from '../src'

import { accountOf, ETH, makeAdapter, RECIPIENT, USDC, USDC_ADDRESS } from './helpers/chain'
import { createRpcMock, hex } from './helpers/rpc'

const ETH_BALANCE = BigInt('1234500000000000000')
const USDC_BALANCE = BigInt(20_000_000)

const balanceOfResult = encodeFunctionResult({ abi: erc20Abi, functionName: 'balanceOf', result: USDC_BALANCE })

const multicallHandler = (params: unknown[]) => {
  const { to, data } = params[0] as { to: string; data: Hex }
  expect(to.toLowerCase()).toBe(baseSepolia.multicall3?.toLowerCase())
  const { args } = decodeFunctionData({ abi: multicall3Abi, data })
  const calls = args[0] as readonly { target: string; callData: Hex }[]
  return encodeFunctionResult({
    abi: multicall3Abi,
    functionName: 'aggregate3',
    result: calls.map((call) => {
      expect(call.target.toLowerCase()).toBe(USDC_ADDRESS.toLowerCase())
      const decoded = decodeFunctionData({ abi: erc20Abi, data: call.callData })
      expect(decoded.functionName).toBe('balanceOf')
      expect(decoded.args).toEqual([RECIPIENT])
      return { success: true, returnData: balanceOfResult }
    }),
  })
}

const account = accountOf(RECIPIENT)

describe('EvmAdapter.getBalances', () => {
  it('reads ETH with eth_getBalance and USDC through one Multicall3 call', async () => {
    const rpc = createRpcMock({ eth_getBalance: () => hex(ETH_BALANCE), eth_call: multicallHandler })

    await expect(makeAdapter(rpc.transport).getBalances(account, [ETH, USDC])).resolves.toEqual({
      [ETH.id]: ETH_BALANCE,
      [USDC.id]: USDC_BALANCE,
    })
    expect(rpc.callsOf('eth_getBalance')[0].params[0]).toBe(RECIPIENT)
    expect(rpc.callsOf('eth_call')).toHaveLength(1)
  })

  it('without Multicall3 calls balanceOf on the token once per asset', async () => {
    const rpc = createRpcMock({
      eth_call: (params) => {
        const { to, data } = params[0] as { to: string; data: Hex }
        expect(to).toBe(USDC_ADDRESS)
        expect(decodeFunctionData({ abi: erc20Abi, data }).functionName).toBe('balanceOf')
        return balanceOfResult
      },
    })
    const adapter = makeAdapter(rpc.transport, { ...baseSepolia, multicall3: undefined })

    await expect(adapter.getBalances(account, [USDC])).resolves.toEqual({ [USDC.id]: USDC_BALANCE })
    expect(rpc.callsOf('eth_getBalance')).toEqual([])
  })

  it('reads only ETH when only ETH is asked', async () => {
    const rpc = createRpcMock({ eth_getBalance: () => hex(ETH_BALANCE) })
    await expect(makeAdapter(rpc.transport).getBalances(account, [ETH])).resolves.toEqual({ [ETH.id]: ETH_BALANCE })
    expect(rpc.callsOf('eth_call')).toEqual([])
  })

  it('refuses an asset that is not on this chain', async () => {
    const rpc = createRpcMock({})
    const foreign = { ...USDC, id: 'eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }
    await expect(makeAdapter(rpc.transport).getBalances(account, [foreign])).rejects.toThrow(EvmAdapterError)
    expect(rpc.calls).toEqual([])
  })

  it('refuses an account of another chain', async () => {
    const rpc = createRpcMock({})
    await expect(makeAdapter(rpc.transport).getBalances({ ...account, chainId: 'eip155:1' }, [ETH])).rejects.toThrow(
      EvmAdapterError
    )
  })
})
