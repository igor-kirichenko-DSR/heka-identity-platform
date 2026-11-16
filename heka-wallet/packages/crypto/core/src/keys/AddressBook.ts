import type { ChainDescriptor } from '../types'
import type { KeyPurpose } from './KeyProvider'

/** Cached public addresses (F03's address record); reading never opens the seed. */
export interface AddressBook {
  /** The binding branch has its own address; payment is the default. */
  getAddress(chain: ChainDescriptor, index: number, purpose?: KeyPurpose): Promise<string | undefined>
}
