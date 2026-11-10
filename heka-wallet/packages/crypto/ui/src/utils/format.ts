import type { AssetDescriptor } from '@heka-wallet/crypto-core'

import { formatUnits } from '@heka-wallet/crypto-core'

import { SHORT_ADDRESS_CHARS } from '../constants'

/** Fraction digits shown in lists; the send review shows the full value. */
export const LIST_FRACTION_DIGITS = 6

const ELLIPSIS = '…'
const TRAILING_ZEROS = /0+$/

/** Cuts the fraction of a decimal string, never rounds: a balance is never shown higher than it is. */
const cutFraction = (value: string, maxFractionDigits: number): string => {
  const [whole, fraction = ''] = value.split('.')
  const kept = fraction.slice(0, maxFractionDigits).replace(TRAILING_ZEROS, '')
  return kept ? `${whole}.${kept}` : whole
}

/** The smallest amount shown with maxFractionDigits, e.g. '0.000001'. */
const smallestShown = (maxFractionDigits: number): string =>
  maxFractionDigits === 0 ? '1' : `0.${'1'.padStart(maxFractionDigits, '0')}`

/** Amount with its symbol, from bigint only; a non-zero amount that would show as 0 reads "< 0.000001". */
export const formatAmount = (amount: bigint, asset: AssetDescriptor, maxFractionDigits?: number): string => {
  const full = formatUnits(amount, asset.decimals)
  if (maxFractionDigits === undefined) return `${full} ${asset.symbol}`
  const shown = cutFraction(full, maxFractionDigits)
  if (shown === '0' && amount > BigInt(0)) return `< ${smallestShown(maxFractionDigits)} ${asset.symbol}`
  return `${shown} ${asset.symbol}`
}

export const shortAddress = (address: string): string =>
  address.length <= SHORT_ADDRESS_CHARS * 2 + 2
    ? address
    : `${address.slice(0, SHORT_ADDRESS_CHARS + 2)}${ELLIPSIS}${address.slice(-SHORT_ADDRESS_CHARS)}`
