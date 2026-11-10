import type { Transport } from 'viem'

import { custom } from 'viem'

export interface RpcCall {
  method: string
  params: unknown[]
}

export type RpcHandler = (params: unknown[]) => unknown

/** A viem transport answering from handlers per JSON-RPC method; an unexpected method fails the test. */
export interface RpcMock {
  transport: Transport
  calls: RpcCall[]
  callsOf(method: string): RpcCall[]
}

export const createRpcMock = (handlers: Record<string, RpcHandler>): RpcMock => {
  const calls: RpcCall[] = []
  const transport = custom(
    {
      request: async ({ method, params }: { method: string; params?: unknown }) => {
        const list = Array.isArray(params) ? params : []
        calls.push({ method, params: list })
        const handler = handlers[method]
        if (!handler) throw new Error(`Unexpected RPC call: ${method}`)
        return handler(list)
      },
    },
    { retryCount: 0 }
  )
  return { transport, calls, callsOf: (method) => calls.filter((call) => call.method === method) }
}

export const hex = (value: number | bigint): string => `0x${value.toString(16)}`
