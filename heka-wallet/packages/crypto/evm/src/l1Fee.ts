import type { Address, Chain, Hex, PublicClient, Transport } from 'viem'

import { serializeTransaction } from 'viem'

import { EvmAdapterError } from './errors'

/** The one function of the OP-Stack GasPriceOracle predeploy that a quote needs. */
const gasPriceOracleAbi = [
  {
    type: 'function',
    name: 'getL1Fee',
    stateMutability: 'view',
    inputs: [{ name: '_data', type: 'bytes' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

/** The fields of the transaction that go on L1; the nonce and the signature are not known at quote time. */
export interface UnsignedTransaction {
  chainId: number
  to: Address
  value: bigint
  data?: Hex
  gas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

/**
 * The L1 data fee of an OP-Stack chain (wei) for a transaction, read from the chain's GasPriceOracle.
 * The node adds it to gas × price when it checks the balance. Nonce 0 stands in for the real nonce: the
 * size differs by a few bytes, which the caller's margin covers. A failed read throws; a missing fee must
 * never turn into a quote that is too low.
 */
export const readL1Fee = async (
  client: PublicClient<Transport, Chain>,
  oracle: Address,
  transaction: UnsignedTransaction
): Promise<bigint> => {
  const unsigned = serializeTransaction({ type: 'eip1559', nonce: 0, ...transaction })
  try {
    return await client.readContract({
      address: oracle,
      abi: gasPriceOracleAbi,
      functionName: 'getL1Fee',
      args: [unsigned],
    })
  } catch (error) {
    throw new EvmAdapterError(`Could not read the L1 data fee: ${error instanceof Error ? error.message : error}`)
  }
}
