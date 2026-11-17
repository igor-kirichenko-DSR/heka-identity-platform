import type { createCirclePaymaster } from './CirclePaymaster'
import type { AaClient, Simple7702 } from './Simple7702Upgrade'
import type { Address, Hex, Log, Transport } from 'viem'

import { PaymasterUnavailableError } from '@heka-wallet/crypto-core'
import { createClient, hexToBigInt } from 'viem'
import { createBundlerClient, UserOperationReceiptNotFoundError } from 'viem/account-abstraction'

import { safeMessage } from './redact'

export interface FeesPerGas {
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

export interface UserOpCall {
  to: Address
  value?: bigint
  data?: Hex
}

/** What a settled user operation tells: its outcome, the bundler transaction and the logs of that transaction. */
export interface SettledUserOp {
  sender: Address
  success: boolean
  actualGasCost: bigint
  transactionHash: Hex
  logs: Log[]
}

/** The bundler as the adapter uses it; tests replace it, the app uses the viem client below. */
export interface UserOpBundler {
  gasPrice(): Promise<FeesPerGas>
  /** Prepares, signs and submits one operation; returns the user-operation hash. */
  send(params: {
    simple: Simple7702
    call: UserOpCall
    paymaster: ReturnType<typeof createCirclePaymaster>
  }): Promise<Hex>
  /** Undefined until the bundler has included the operation. */
  receipt(hash: Hex): Promise<SettledUserOp | undefined>
}

interface PimlicoGasPrice {
  standard: { maxFeePerGas: Hex; maxPriorityFeePerGas: Hex }
}

/** Wraps anything the bundler path throws, so the UI can offer native fees. */
const unavailable = (what: string, cause: unknown): PaymasterUnavailableError =>
  new PaymasterUnavailableError(`${what}: ${safeMessage(cause)}`)

/** The viem bundler client over the registry's bundler URL; Pimlico's gas price is read through a raw request. */
export const createViemBundler = (params: { client: AaClient; transport: Transport }): UserOpBundler => {
  const { client, transport } = params
  const rpc = createClient({ transport })

  const gasPrice = async (): Promise<FeesPerGas> => {
    try {
      const request = rpc.request as (args: { method: string; params: unknown[] }) => Promise<PimlicoGasPrice>
      const { standard } = await request({ method: 'pimlico_getUserOperationGasPrice', params: [] })
      return {
        maxFeePerGas: hexToBigInt(standard.maxFeePerGas),
        maxPriorityFeePerGas: hexToBigInt(standard.maxPriorityFeePerGas),
      }
    } catch (cause) {
      throw unavailable('The bundler did not return a gas price', cause)
    }
  }

  return {
    gasPrice,
    async send({ simple, call, paymaster }) {
      try {
        const bundler = createBundlerClient({
          account: simple.account,
          client,
          paymaster,
          transport,
          userOperation: { estimateFeesPerGas: gasPrice },
        })
        return await bundler.sendUserOperation({ calls: [call], authorization: simple.authorization })
      } catch (cause) {
        throw unavailable('The user operation could not be sent', cause)
      }
    },
    async receipt(hash) {
      const bundler = createBundlerClient({ client, transport })
      try {
        const settled = await bundler.getUserOperationReceipt({ hash })
        return {
          sender: settled.sender,
          success: settled.success,
          actualGasCost: settled.actualGasCost,
          transactionHash: settled.receipt.transactionHash,
          logs: settled.receipt.logs,
        }
      } catch (cause) {
        if (cause instanceof UserOperationReceiptNotFoundError) return undefined
        throw cause
      }
    },
  }
}
