import type { Agent } from '@credo-ts/core'
import type { Session } from '@openwallet-foundation/askar-shared'

import { AskarStoreManager } from '@credo-ts/askar'

export type AskarTransactionRunner = <T>(callback: (session: Session) => Promise<T>) => Promise<T>

/** The agent's store is closed (lockout shut the agent down); the crypto seed store must not reopen it. */
export class AskarStoreClosedError extends Error {
  constructor() {
    super('The wallet store is closed')
    this.name = 'AskarStoreClosedError'
  }
}

/**
 * Raw Askar access for the crypto seed store: every callback runs in one transaction, committed on success and
 * rolled back on error. Pass the main agent (useHekaAgent) only, never the DC API agent.
 */
export const createAgentTransactionRunner =
  (agent: Pick<Agent, 'dependencyManager' | 'context'>): AskarTransactionRunner =>
  async (callback) => {
    const storeManager = agent.dependencyManager.resolve(AskarStoreManager)
    // Credo reopens a missing store with the PIN-derived key it still holds; after lockout that must not happen.
    if (!storeManager.isStoreOpen(agent.context)) throw new AskarStoreClosedError()
    return storeManager.withTransaction(agent.context, callback)
  }
