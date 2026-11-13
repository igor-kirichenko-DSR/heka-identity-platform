import type { MirrorTransaction, MirrorTransfer } from './mirrorTypes'
import type { AssetDescriptor, ChainId, TxDirection, TxRecord } from '@heka-wallet/crypto-core'

import { entityIdOf } from './entityId'

export interface MirrorMappingContext {
  chainId: ChainId
  /** The holder's EVM address, as the record's `account`. */
  holderAddress: string
  /** The holder's `0.0.x`. */
  holderId: string
  nativeAsset: AssetDescriptor
  /** HTS assets the wallet shows; transfers of any other token are ignored. */
  tokens: AssetDescriptor[]
  /** Ethereum hash of a relay transaction, so a chain record de-duplicates with the local ledger entry. */
  resolveEthereumHash: (transactionId: string) => Promise<string | undefined>
}

const ZERO = BigInt(0)
const ETHEREUM_TRANSACTION = 'ETHEREUMTRANSACTION'
/** Network service accounts (fees, rewards, nodes) are below this number; they are never a counterparty. */
const FIRST_USER_ACCOUNT = 1000
const TREASURY_ACCOUNT = 2

/** Fee, reward and node accounts (0.0.3 to 0.0.999) are never a counterparty; the treasury (0.0.2, faucets) is. */
const isCounterparty = (id: string): boolean => {
  const number = accountNumber(id)
  return number === TREASURY_ACCOUNT || number >= FIRST_USER_ACCOUNT
}

const abs = (value: bigint): bigint => (value < ZERO ? -value : value)

const accountNumber = (id: string): number => Number(id.split('.')[2])

const netOf = (transfers: MirrorTransfer[], holderId: string): bigint =>
  transfers.filter((t) => t.account === holderId).reduce((sum, t) => sum + t.amount, ZERO)

/** The user account on the other side: the biggest opposite-signed transfer. */
const counterpartyOf = (transfers: MirrorTransfer[], holderId: string, net: bigint): string => {
  const others = transfers.filter(
    (t) => t.account !== holderId && isCounterparty(t.account) && (net < ZERO ? t.amount > ZERO : t.amount < ZERO)
  )
  const best = others.reduce<MirrorTransfer | undefined>(
    (top, t) => (!top || abs(t.amount) > abs(top.amount) ? t : top),
    undefined
  )
  return best?.account ?? ''
}

const directionOf = (net: bigint): TxDirection => (net < ZERO ? 'out' : 'in')

const groupByTransactionId = (items: MirrorTransaction[]): MirrorTransaction[][] => {
  const groups = new Map<string, MirrorTransaction[]>()
  items.forEach((item) => groups.set(item.transactionId, [...(groups.get(item.transactionId) ?? []), item]))
  return [...groups.values()]
}

const toRecord = async (group: MirrorTransaction[], ctx: MirrorMappingContext): Promise<TxRecord | undefined> => {
  const parent = group.find((t) => t.nonce === 0) ?? group[0]
  const failed = group.some((t) => t.result !== 'SUCCESS')
  const hbar = group.flatMap((t) => t.transfers)
  const hbarNet = netOf(hbar, ctx.holderId)
  // The holder paid the fee when its HBAR movement covers it (a relay transaction is paid by the relay's payer id)
  const feePaid = hbarNet < ZERO && -hbarNet >= parent.chargedFee
  const hbarValue = feePaid ? hbarNet + parent.chargedFee : hbarNet

  const tokenTransfers = group.flatMap((t) => t.tokenTransfers)
  const tracked = ctx.tokens
    .map((asset) => {
      const transfers = tokenTransfers.filter((t) => t.tokenId === entityIdOf(asset.address ?? ''))
      return { asset, transfers, net: netOf(transfers, ctx.holderId) }
    })
    .find((entry) => entry.net !== ZERO)

  let asset = ctx.nativeAsset
  let amount = abs(hbarValue)
  let direction = directionOf(hbarValue)
  let counterparty = counterpartyOf(hbar, ctx.holderId, hbarValue)
  if (tracked) {
    asset = tracked.asset
    amount = abs(tracked.net)
    direction = directionOf(tracked.net)
    counterparty = counterpartyOf(tracked.transfers, ctx.holderId, tracked.net)
  } else if (hbarValue === ZERO) {
    // Nothing the wallet shows moved; a failed transaction the holder paid for is still worth a row
    if (!(failed && feePaid)) return undefined
    direction = 'out'
  }
  if (failed) amount = ZERO

  const txId =
    parent.name === ETHEREUM_TRANSACTION
      ? ((await ctx.resolveEthereumHash(parent.transactionId)) ?? parent.transactionId)
      : parent.transactionId
  return {
    chainId: ctx.chainId,
    account: ctx.holderAddress,
    txId,
    explorerHash: txId,
    direction,
    asset,
    amount,
    counterparty,
    ...(feePaid ? { fee: { asset: ctx.nativeAsset, amount: parent.chargedFee } } : {}),
    status: failed ? 'failed' : 'success',
    createdAt: parent.consensusMs,
    source: 'chain',
  }
}

/**
 * Mirror Node transactions → one record per transaction id (a relay transfer is a parent with child
 * transactions that carry the token movement). Newest first, as the Mirror Node returns them.
 */
export const mapMirrorTransactions = async (
  items: MirrorTransaction[],
  ctx: MirrorMappingContext
): Promise<TxRecord[]> => {
  const records = await Promise.all(groupByTransactionId(items).map((group) => toRecord(group, ctx)))
  return records.filter((record): record is TxRecord => record !== undefined)
}
