import type { Address, Client, Hex, PrivateKeyAccount } from 'viem'

import { encodePacked, maxUint256, parseAbi, parseErc6492Signature } from 'viem'
import { readContract } from 'viem/actions'

import { EvmAdapterError } from '../errors'

import { permitCeiling } from './feeRate'

// The paymaster's validation and post-operation gas, as measured in Spike D
const PAYMASTER_VERIFICATION_GAS = BigInt(200_000)
const PAYMASTER_POST_OP_GAS = BigInt(35_000)
// Circle Paymaster data: a mode byte (0 = permit), the token, the permit amount, the permit signature
const PERMIT_MODE = 0
// A paymaster cannot read block.timestamp under ERC-4337 rules, so the permit has no deadline
const NO_DEADLINE = maxUint256

const PERMIT_ABI = parseAbi([
  'function name() view returns (string)',
  'function version() view returns (string)',
  'function nonces(address owner) view returns (uint256)',
])

const PERMIT_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

export interface PermitParams {
  owner: Address
  token: Address
  spender: Address
  chainId: number
  value: bigint
}

/** The EIP-2612 typed data; name, version and nonce come from the token contract. */
export const buildPermitTypedData = async (client: Client, params: PermitParams) => {
  const { owner, token, spender, chainId, value } = params
  const [name, version, nonce] = await Promise.all([
    readContract(client, { address: token, abi: PERMIT_ABI, functionName: 'name' }),
    readContract(client, { address: token, abi: PERMIT_ABI, functionName: 'version' }),
    readContract(client, { address: token, abi: PERMIT_ABI, functionName: 'nonces', args: [owner] }),
  ])
  return {
    domain: { name, version, chainId, verifyingContract: token },
    types: PERMIT_TYPES,
    primaryType: 'Permit' as const,
    message: { owner, spender, value, nonce, deadline: NO_DEADLINE },
  }
}

/** Signs the permit with the smart account (an ERC-6492 wrapper is removed, as Circle's sample does). */
export const signPermit = async (
  client: Client,
  signer: { signTypedData: PrivateKeyAccount['signTypedData'] },
  params: PermitParams
): Promise<Hex> => {
  const typedData = await buildPermitTypedData(client, params)
  const signature = await signer.signTypedData(typedData)
  return parseErc6492Signature(signature).signature
}

/** paymasterData: mode byte, token, permit amount, permit signature. */
export const packPaymasterData = (token: Address, amount: bigint, signature: Hex): Hex =>
  encodePacked(['uint8', 'address', 'uint256', 'bytes'], [PERMIT_MODE, token, amount, signature])

// The permit signed for gas estimation: the bundler simulates the operation, and the paymaster pulls its prefund with
// transferFrom, so a dummy or tiny permit reverts (AA33, 'amount exceeds allowance'). Same 10 USDC as Spike D; never submitted.
const ESTIMATION_PERMIT_VALUE = BigInt(10_000_000)

export interface CirclePaymasterParams {
  client: Client
  signer: { signTypedData: PrivateKeyAccount['signTypedData'] }
  owner: Address
  paymaster: Address
  token: Address
  chainId: number
  /** USDC base units per 1 ETH, read when the permit is signed. */
  rate: () => bigint
  /** The most the holder allowed as a fee; a larger permit is refused before it is signed. */
  ceilingCap?: bigint
  /** Called with the refusal, because the bundler client may wrap what the hook throws. */
  onRefused?: (error: EvmAdapterError) => void
}

interface OperationCost {
  callGasLimit?: bigint
  verificationGasLimit?: bigint
  preVerificationGas?: bigint
  maxFeePerGas?: bigint
}

/** The worst-case cost of an operation in wei: every gas limit at the max fee, paymaster gas included. */
export const maxOperationCost = (operation: OperationCost): bigint => {
  const zero = BigInt(0)
  const gas =
    (operation.callGasLimit ?? zero) +
    (operation.verificationGasLimit ?? zero) +
    (operation.preVerificationGas ?? zero) +
    PAYMASTER_VERIFICATION_GAS +
    PAYMASTER_POST_OP_GAS
  return gas * (operation.maxFeePerGas ?? zero)
}

/** The paymaster hooks viem's bundler client calls: a generous signed permit for estimation, the sized one for sending. */
export const createCirclePaymaster = (params: CirclePaymasterParams) => {
  const { client, signer, owner, paymaster, token, chainId, rate, ceilingCap, onRefused } = params
  const limits = {
    paymaster,
    paymasterVerificationGasLimit: PAYMASTER_VERIFICATION_GAS,
    paymasterPostOpGasLimit: PAYMASTER_POST_OP_GAS,
  }
  return {
    async getPaymasterStubData() {
      const value = ESTIMATION_PERMIT_VALUE
      const signature = await signPermit(client, signer, { owner, token, spender: paymaster, chainId, value })
      return { ...limits, paymasterData: packPaymasterData(token, value, signature), isFinal: false }
    },
    async getPaymasterData(operation: OperationCost) {
      const value = permitCeiling(maxOperationCost(operation), rate())
      if (ceilingCap !== undefined && value > ceilingCap) {
        const refusal = new EvmAdapterError(`Fee ceiling ${value} is above the cap ${ceilingCap}`)
        onRefused?.(refusal)
        throw refusal
      }
      const signature = await signPermit(client, signer, { owner, token, spender: paymaster, chainId, value })
      return { ...limits, paymasterData: packPaymasterData(token, value, signature), isFinal: true }
    },
  }
}
