// EIP-681 payment URIs ('ethereum:0x…@84532?value=…'): read from a scanned QR code, written for the Receive QR code.
import type { ChainId } from '../types'

import { UriError } from '../errors'

import { eip155ChainId, eip155Reference } from './caip'
import { pow10 } from './units'

/** ethereum:[pay-]<target>[@<chain_id>][/<function_name>][?<parameters>] */
const EIP681_PATTERN = /^ethereum:(?:pay-)?([^@/?]+)(?:@([1-9]\d*))?(?:\/([^?]+))?(?:\?(.*))?$/
/** EIP-681 number without a sign: digits, optional fraction, optional exponent. */
const EIP681_NUMBER_PATTERN = /^(\d+)(?:\.(\d+))?(?:[eE](\d+))?$/
const TRANSFER_FUNCTION = 'transfer'
/** An amount is a uint256; it has at most 78 digits. Bounds the exponent before any power of 10 is computed. */
const MAX_UINT256_DIGITS = 78
const MAX_UINT256 = (BigInt(1) << BigInt(256)) - BigInt(1)

/** A payment request read from or written to an EIP-681 URI. */
export interface PaymentRequest {
  /** Absent: the URI names no chain (the wallet's current chain applies). */
  chainId?: ChainId
  /** Recipient. */
  to: string
  /** ERC-20 contract; absent for the native asset. */
  token?: string
  /** In the asset's smallest unit. */
  amount?: bigint
}

const decode = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    throw new UriError(`Malformed percent-encoding in EIP-681 parameter: ${value}`)
  }
}

const parseParameters = (query: string | undefined): Map<string, string> => {
  const parameters = new Map<string, string>()
  if (!query) return parameters
  for (const pair of query.split('&')) {
    if (!pair) continue
    const separator = pair.indexOf('=')
    if (separator <= 0) throw new UriError(`Malformed EIP-681 parameter: ${pair}`)
    parameters.set(decode(pair.slice(0, separator)), decode(pair.slice(separator + 1)))
  }
  return parameters
}

const toUint256 = (amount: bigint, value: string): bigint => {
  if (amount > MAX_UINT256) throw new UriError(`EIP-681 amount too large: ${value}`)
  return amount
}

/**
 * EIP-681 amounts may use scientific notation ('2.014e18'); the result must be a whole number that fits in a uint256.
 * The input comes from a scanned QR code, so the exponent is bounded before it is applied.
 */
export const parseEip681Number = (value: string): bigint => {
  const match = EIP681_NUMBER_PATTERN.exec(value)
  if (!match) throw new UriError(`Invalid EIP-681 number: ${value}`)
  const [, whole, fraction = '', exponent = '0'] = match
  const digits = `${whole}${fraction}`.replace(/^0+/, '')
  if (!digits) return BigInt(0)
  const exponentDigits = exponent.replace(/^0+/, '')
  if (exponentDigits.length > String(MAX_UINT256_DIGITS).length)
    throw new UriError(`EIP-681 amount too large: ${value}`)
  const shift = Number(exponentDigits || '0') - fraction.length
  // Digits left of the decimal point after the shift: more than a uint256 holds means too large, before any math.
  if (digits.length + shift > MAX_UINT256_DIGITS) throw new UriError(`EIP-681 amount too large: ${value}`)
  if (shift >= 0) return toUint256(BigInt(digits) * pow10(shift), value)
  const dropped = digits.slice(shift)
  if (/[^0]/.test(dropped)) throw new UriError(`EIP-681 amount is not a whole number: ${value}`)
  return toUint256(BigInt(digits.slice(0, shift) || '0'), value)
}

export const parseEip681 = (uri: string): PaymentRequest => {
  const match = EIP681_PATTERN.exec(uri)
  if (!match) throw new UriError('Not an EIP-681 URI')
  const [, target, chainReference, functionName, query] = match
  const parameters = parseParameters(query)
  const chainId = chainReference ? eip155ChainId(BigInt(chainReference)) : undefined

  if (functionName === undefined) {
    const value = parameters.get('value')
    return { chainId, to: target, amount: value === undefined ? undefined : parseEip681Number(value) }
  }
  if (functionName !== TRANSFER_FUNCTION) throw new UriError(`Unsupported EIP-681 function: ${functionName}`)

  const to = parameters.get('address')
  if (!to) throw new UriError('EIP-681 transfer without an address parameter')
  const amount = parameters.get('uint256')
  return { chainId, to, token: target, amount: amount === undefined ? undefined : parseEip681Number(amount) }
}

export const buildEip681 = (request: PaymentRequest & { chainId: ChainId }): string => {
  const reference = eip155Reference(request.chainId)
  if (reference === undefined) throw new UriError(`EIP-681 needs an EVM chain, got ${request.chainId}`)
  if (request.amount !== undefined && request.amount < BigInt(0)) throw new UriError('Negative amount')

  if (!request.token) {
    const value = request.amount === undefined ? '' : `?value=${request.amount}`
    return `ethereum:${request.to}@${reference}${value}`
  }
  const amount = request.amount === undefined ? '' : `&uint256=${request.amount}`
  return `ethereum:${request.token}@${reference}/${TRANSFER_FUNCTION}?address=${request.to}${amount}`
}
