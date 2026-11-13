import type { ChainId } from '../types'
import type { ChainAdapter } from './ChainAdapter'

import { RegistryError } from '../errors'

export class AdapterRegistry {
  private readonly adapters = new Map<ChainId, ChainAdapter>()

  register(adapter: ChainAdapter): void {
    const { id, enabled } = adapter.chain
    if (!enabled) throw new RegistryError(`Chain ${id} is disabled`)
    if (this.adapters.has(id)) throw new RegistryError(`Chain ${id} is already registered`)
    this.adapters.set(id, adapter)
  }

  has(chainId: ChainId): boolean {
    return this.adapters.has(chainId)
  }

  get(chainId: ChainId): ChainAdapter {
    const adapter = this.adapters.get(chainId)
    if (!adapter) throw new RegistryError(`Chain ${chainId} is not registered`)
    return adapter
  }

  /** In registration order. */
  list(): ChainAdapter[] {
    return [...this.adapters.values()]
  }
}
