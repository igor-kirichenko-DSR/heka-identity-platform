import type { AssetDescriptor, AssetId, FeeQuote } from '@heka-wallet/crypto-core'

export type FundsCheck = 'ok' | 'insufficient-amount' | 'insufficient-fee'

interface FundsInput {
  asset: AssetDescriptor
  amount: bigint
  quote: FeeQuote
  balances: Record<AssetId, bigint>
}

const ZERO = BigInt(0)

/** The most the fee can cost: the permit ceiling in paymaster mode, else the quote. */
export const feeCeiling = (quote: FeeQuote): bigint => quote.max ?? quote.amount

/** Amount and fee against the balances, all in bigint; the fee may be paid in the sent asset or another one. */
export const checkFunds = ({ asset, amount, quote, balances }: FundsInput): FundsCheck => {
  const assetBalance = balances[asset.id] ?? ZERO
  const fee = feeCeiling(quote)
  if (amount > assetBalance) return 'insufficient-amount'
  if (quote.asset.id === asset.id) return amount + fee > assetBalance ? 'insufficient-fee' : 'ok'
  return fee > (balances[quote.asset.id] ?? ZERO) ? 'insufficient-fee' : 'ok'
}

/** "Max": the whole balance, less the fee when the fee is paid in the same asset; never below zero. */
export const maxAmount = (asset: AssetDescriptor, balances: Record<AssetId, bigint>, quote?: FeeQuote): bigint => {
  const balance = balances[asset.id] ?? ZERO
  if (!quote || quote.asset.id !== asset.id) return balance
  const rest = balance - feeCeiling(quote)
  return rest > ZERO ? rest : ZERO
}
