import type { ChainId } from '@heka-wallet/crypto-core'

/** Where the holder's default chain is kept between app starts. */
export interface ChainPreference {
  get(): Promise<ChainId | undefined>
  set(chainId: ChainId): Promise<void>
}
