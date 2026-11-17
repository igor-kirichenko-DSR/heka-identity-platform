import type { SettledUserOp, UserOpBundler, UserOpCall } from './BundlerClient'
import type { AaClient } from './Simple7702Upgrade'
import type {
  AssetDescriptor,
  FeeQuote,
  KeyProvider,
  PaymasterConfig,
  StatusResult,
  TransferRequest,
  TransferResult,
} from '@heka-wallet/crypto-core'
import type { Address, Hex } from 'viem'

import { ForeignDelegationError, formatUnits, PaymasterUnavailableError, sameAddress } from '@heka-wallet/crypto-core'
import { erc20Abi, getAddress, parseEventLogs } from 'viem'

import { EvmAdapterError } from '../errors'
import { type AaConfig } from '../types'

import { createCirclePaymaster } from './CirclePaymaster'
import { prepareSimple7702, readDelegation, toPrivateKeyOwner } from './Simple7702Upgrade'
import { estimateUsdcFee, RateTracker, rateFromReceipt } from './feeRate'
import { safeMessage } from './redact'

export interface PaymasterSenderOptions {
  chainId: number
  paymaster: PaymasterConfig
  aa: AaConfig
  /** The fee token: the chain's USDC. */
  usdc: AssetDescriptor
  client: AaClient
  bundler: UserOpBundler
}

const ZERO = BigInt(0)

/** The USDC-fee path of an EVM chain: quote, send as a user operation, and read the charge back. */
export class PaymasterSender {
  private readonly rate: RateTracker
  /** Operation hashes this session submitted, so a status poll knows to ask the bundler first. */
  private readonly submitted = new Set<string>()

  constructor(private readonly options: PaymasterSenderOptions) {
    this.rate = new RateTracker(options.aa.seedUsdcPerEth)
  }

  /** The paymaster contract; its transfers are fees, not payments. */
  get paymasterAddress(): Address {
    return getAddress(this.options.paymaster.address)
  }

  knows(txId: string): boolean {
    return this.submitted.has(txId.toLowerCase())
  }

  /** Keyless estimate: modelled gas at the bundler's gas price and the current rate; `max` is the ceiling. */
  async quote(from: Address): Promise<FeeQuote> {
    const { usdc, aa, client, bundler } = this.options
    const delegation = await this.readDelegation(client, from)
    if (delegation === 'foreign') {
      throw new ForeignDelegationError(`${from} is delegated to a contract other than ${aa.implementation}`)
    }
    const { maxFeePerGas } = await bundler.gasPrice()
    const { amount, max } = estimateUsdcFee({
      delegated: delegation === 'pinned',
      maxFeePerGas,
      rate: this.rate.current(),
    })
    return {
      mode: 'usdc-paymaster',
      asset: usdc,
      amount,
      max,
      display: `${formatUnits(amount, usdc.decimals)} ${usdc.symbol}`,
    }
  }

  /** Opens the key for the signatures only; any failure before the bundler accepts the operation is unavailable. */
  async send(req: TransferRequest, call: UserOpCall, keys: KeyProvider): Promise<TransferResult> {
    const { chainId, usdc, aa, client, bundler } = this.options
    const sender = getAddress(req.from.address)
    let refusal: EvmAdapterError | undefined
    try {
      const hash = await keys.withAccount('payment', req.from.index, async (account) => {
        if (!sameAddress(account.address, sender)) {
          throw new EvmAdapterError(`Key #${req.from.index} does not belong to the sender ${sender}`)
        }
        const owner = toPrivateKeyOwner(account)
        const simple = await prepareSimple7702({ client, owner, implementation: aa.implementation, chainId })
        const hooks = createCirclePaymaster({
          client,
          signer: owner,
          owner: sender,
          paymaster: this.paymasterAddress,
          token: getAddress(usdc.address ?? ''),
          chainId,
          rate: () => this.rate.current(),
          ceilingCap: req.feeCap,
          onRefused: (error) => {
            refusal = error
          },
        })
        return bundler.send({ simple, call, paymaster: hooks })
      })
      this.submitted.add(hash.toLowerCase())
      return { txId: hash }
    } catch (error) {
      if (refusal) throw refusal
      if (error instanceof ForeignDelegationError || error instanceof EvmAdapterError) throw error
      if (error instanceof PaymasterUnavailableError) throw error
      throw new PaymasterUnavailableError(safeMessage(error))
    }
  }

  /** Undefined while the bundler has no receipt; on inclusion the net USDC charge and the bundler transaction. */
  async status(txId: string): Promise<StatusResult | undefined> {
    const settled = await this.options.bundler.receipt(txId as Hex)
    if (!settled) return undefined
    const charged = this.chargedFee(settled)
    this.rate.update(rateFromReceipt(charged, settled.actualGasCost))
    return {
      status: settled.success ? 'success' : 'failed',
      explorerHash: settled.transactionHash,
      fee: { asset: this.options.usdc, amount: charged },
    }
  }

  private async readDelegation(client: AaClient, from: Address) {
    try {
      return await readDelegation(client, from, getAddress(this.options.aa.implementation))
    } catch (cause) {
      throw new PaymasterUnavailableError(`The account code could not be read: ${safeMessage(cause)}`)
    }
  }

  /** The prefund the paymaster pulled minus what it gave back, in the fee token. */
  private chargedFee(settled: SettledUserOp): bigint {
    const token = getAddress(this.options.usdc.address ?? '')
    const paymaster = this.paymasterAddress
    const transfers = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: settled.logs }).filter((log) =>
      sameAddress(log.address, token)
    )
    const sum = (from: Address, to: Address): bigint =>
      transfers
        .filter((log) => sameAddress(log.args.from, from) && sameAddress(log.args.to, to))
        .reduce((total, log) => total + log.args.value, ZERO)
    const net = sum(settled.sender, paymaster) - sum(paymaster, settled.sender)
    return net > ZERO ? net : ZERO
  }
}
