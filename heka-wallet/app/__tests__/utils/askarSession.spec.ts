import type { Agent } from '@credo-ts/core'
import type { Session } from '@openwallet-foundation/askar-shared'

import { AskarStoreManager } from '@credo-ts/askar'

import { AskarStoreClosedError, createAgentTransactionRunner } from '../../src/utils/askarSession'

// The real store manager loads native Askar; only its isStoreOpen / withTransaction contract matters here.
jest.mock('@credo-ts/askar', () => ({ AskarStoreManager: class AskarStoreManager {} }))

const session = { fetch: jest.fn() } as unknown as Session

const makeAgent = ({ storeOpen = true } = {}) => {
  const storeManager = {
    isStoreOpen: jest.fn(() => storeOpen),
    withTransaction: jest.fn(async (_context: unknown, callback: (session: Session) => Promise<unknown>) =>
      callback(session)
    ),
  }
  const context = { contextCorrelationId: 'main' }
  const resolve = jest.fn(() => storeManager)
  const agent = { dependencyManager: { resolve }, context } as unknown as Pick<Agent, 'dependencyManager' | 'context'>
  return { agent, storeManager, context, resolve }
}

describe('createAgentTransactionRunner', () => {
  it('runs the callback in a transaction on the agent context and returns its result', async () => {
    const { agent, storeManager, context, resolve } = makeAgent()
    const run = createAgentTransactionRunner(agent)

    const result = await run(async (received) => (received === session ? 'value' : 'other'))

    expect(result).toBe('value')
    expect(resolve).toHaveBeenCalledWith(AskarStoreManager)
    expect(storeManager.isStoreOpen).toHaveBeenCalledWith(context)
    expect(storeManager.withTransaction).toHaveBeenCalledWith(context, expect.any(Function))
  })

  it('passes the error of the callback through', async () => {
    const { agent } = makeAgent()
    const failure = new Error('duplicate entry')

    await expect(
      createAgentTransactionRunner(agent)(async () => {
        throw failure
      })
    ).rejects.toBe(failure)
  })

  it('refuses without reopening when lockout has closed the store', async () => {
    const { agent, storeManager } = makeAgent({ storeOpen: false })
    const callback = jest.fn(async () => 'value')

    await expect(createAgentTransactionRunner(agent)(callback)).rejects.toThrow(AskarStoreClosedError)
    expect(storeManager.withTransaction).not.toHaveBeenCalled()
    expect(callback).not.toHaveBeenCalled()
  })
})
