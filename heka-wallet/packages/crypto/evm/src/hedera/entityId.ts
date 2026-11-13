import type { Address } from 'viem'

import { EvmAdapterError } from '../errors'

const ENTITY_ID = /^0\.0\.(\d+)$/
const LONG_ZERO = /^0x0{24}([0-9a-fA-F]{16})$/

/** '0.0.429274' → the 20-byte long-zero EVM address of the entity number. */
export const longZeroAddress = (entityId: string): Address => {
  const match = ENTITY_ID.exec(entityId)
  if (!match) throw new EvmAdapterError(`Not a Hedera entity id: ${entityId}`)
  return `0x${BigInt(match[1]).toString(16).padStart(40, '0')}` as Address
}

/** The inverse of longZeroAddress; undefined for any other address. */
export const entityIdOf = (address: string): string | undefined => {
  const match = LONG_ZERO.exec(address)
  return match ? `0.0.${BigInt(`0x${match[1]}`).toString()}` : undefined
}
