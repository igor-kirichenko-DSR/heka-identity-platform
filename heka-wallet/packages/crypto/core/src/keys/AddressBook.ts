import type { ChainDescriptor } from '../types'

/** Cached public addresses (F03's address record); reading never opens the seed. */
export interface AddressBook {
  getAddress(chain: ChainDescriptor, index: number): Promise<string | undefined>
}
