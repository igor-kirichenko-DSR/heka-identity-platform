import type { Address, Hex } from 'viem'

import { createClient, encodeAbiParameters, maxUint256, recoverTypedDataAddress } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

import {
  buildPermitTypedData,
  createCirclePaymaster,
  maxOperationCost,
  packPaymasterData,
  permitCeiling,
  signPermit,
} from '../../src/aa'
import { createRpcMock } from '../helpers/rpc'

const USDC: Address = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const PAYMASTER: Address = '0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966'
const CHAIN_ID = 84532
const NONCE = BigInt(3)

// Selectors of name(), version() and nonces(address)
const NAME_SELECTOR = '0x06fdde03'
const VERSION_SELECTOR = '0x54fd4d50'
const NONCES_SELECTOR = '0x7ecebe00'

const tokenClient = () => {
  const mock = createRpcMock({
    eth_call: ([call]) => {
      const data = (call as { data: Hex }).data
      if (data.startsWith(NAME_SELECTOR)) return encodeAbiParameters([{ type: 'string' }], ['USDC'])
      if (data.startsWith(VERSION_SELECTOR)) return encodeAbiParameters([{ type: 'string' }], ['2'])
      if (data.startsWith(NONCES_SELECTOR)) return encodeAbiParameters([{ type: 'uint256' }], [NONCE])
      throw new Error(`Unexpected call ${data}`)
    },
  })
  return createClient({ transport: mock.transport })
}

const owner = privateKeyToAccount(generatePrivateKey())

describe('packPaymasterData', () => {
  it('packs the mode byte, the token, the amount and the signature', () => {
    const signature: Hex = '0xabcdef'
    const packed = packPaymasterData(USDC, BigInt(5_000), signature)
    expect(packed).toBe(
      `0x00${USDC.slice(2).toLowerCase()}${BigInt(5_000).toString(16).padStart(64, '0')}${signature.slice(2)}`
    )
  })
})

describe('buildPermitTypedData', () => {
  it('takes the domain and the nonce from the token contract and has no deadline', async () => {
    const typedData = await buildPermitTypedData(tokenClient(), {
      owner: owner.address,
      token: USDC,
      spender: PAYMASTER,
      chainId: CHAIN_ID,
      value: BigInt(9_000),
    })
    expect(typedData.domain).toEqual({ name: 'USDC', version: '2', chainId: CHAIN_ID, verifyingContract: USDC })
    expect(typedData.message).toEqual({
      owner: owner.address,
      spender: PAYMASTER,
      value: BigInt(9_000),
      nonce: NONCE,
      deadline: maxUint256,
    })
  })
})

describe('signPermit', () => {
  it('signs a permit that recovers to the owner', async () => {
    const params = { owner: owner.address, token: USDC, spender: PAYMASTER, chainId: CHAIN_ID, value: BigInt(9_000) }
    const client = tokenClient()
    const signature = await signPermit(client, owner, params)
    const typedData = await buildPermitTypedData(client, params)
    expect(await recoverTypedDataAddress({ ...typedData, signature })).toBe(owner.address)
  })
})

describe('createCirclePaymaster', () => {
  const rate = BigInt(3_345_300_000)
  const operation = {
    callGasLimit: BigInt(50_000),
    verificationGasLimit: BigInt(100_000),
    preVerificationGas: BigInt(60_000),
    maxFeePerGas: BigInt(10_000_000),
  }

  const make = () =>
    createCirclePaymaster({
      client: tokenClient(),
      signer: owner,
      owner: owner.address,
      paymaster: PAYMASTER,
      token: USDC,
      chainId: CHAIN_ID,
      rate: () => rate,
    })

  it('sizes the permit to the operation worst case with a margin', async () => {
    const data = await make().getPaymasterData(operation)
    const value = permitCeiling(maxOperationCost(operation), rate)
    expect(data.paymaster).toBe(PAYMASTER)
    expect(data.isFinal).toBe(true)
    expect(data.paymasterData.slice(0, 4 + 40 + 64)).toBe(
      `0x00${USDC.slice(2).toLowerCase()}${value.toString(16).padStart(64, '0')}`
    )
  })

  it('signs a real permit for estimation, large enough for the prefund, so the simulation does not revert (AA33)', async () => {
    const stub = await make().getPaymasterStubData()
    expect(stub.isFinal).toBe(false)
    const amount = BigInt(`0x${stub.paymasterData.slice(2 + 2 + 40, 2 + 2 + 40 + 64)}`)
    expect(amount).toBe(BigInt(10_000_000))
    const signature = `0x${stub.paymasterData.slice(2 + 2 + 40 + 64)}` as Hex
    expect(signature).not.toBe(`0x${'00'.repeat(64)}1b`)
    const typedData = await buildPermitTypedData(tokenClient(), {
      owner: owner.address,
      token: USDC,
      spender: PAYMASTER,
      chainId: CHAIN_ID,
      value: amount,
    })
    expect(await recoverTypedDataAddress({ ...typedData, signature })).toBe(owner.address)
    expect(stub.paymasterVerificationGasLimit).toBeGreaterThan(BigInt(0))
    expect(stub.paymasterPostOpGasLimit).toBeGreaterThan(BigInt(0))
  })
})
