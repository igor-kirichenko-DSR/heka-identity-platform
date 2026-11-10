import { render } from '@testing-library/react-native'
import React from 'react'

import { CryptoHost } from '../../src/components/crypto/CryptoHost'
import { AskarStoreClosedError } from '../../src/utils/askarSession'

type ProviderProps = {
  isAgentReady: boolean
  backup?: { backupNow: () => Promise<void> }
  defaultChainId: string
  withSeedSession: (callback: (session: unknown) => Promise<unknown>) => Promise<unknown>
  createAdapters: (addressBook: unknown) => Array<{ chain: { id: string; rpcUrl?: string } }>
}

jest.mock('@credo-ts/askar', () => ({ AskarStoreManager: class {} }))

let mockAgent: object | undefined
let mockBackupEnabled = false
let mockRpcOverride: string | undefined
const mockProvider = jest.fn()
const mockMountRead = jest.fn()
const mockBackupWallet = jest.fn()

// Like the real provider, the mock reads the store from its own effect on mount (child effects run before parent ones).
jest.mock('@heka-wallet/crypto-ui', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    CryptoProvider: (props: ProviderProps) => {
      mockProvider(props)
      const { isAgentReady, withSeedSession } = props
      useEffect(() => {
        if (isAgentReady) mockMountRead(withSeedSession(async (session: unknown) => session))
      }, [isAgentReady, withSeedSession])
      return null
    },
  }
})
jest.mock('../../src/config', () => ({
  get isWalletBackupEnabled() {
    return mockBackupEnabled
  },
  getCryptoConfig: () => ({
    defaultChain: 'eip155:84532',
    overrides: mockRpcOverride ? { 'eip155:84532': { rpcUrl: mockRpcOverride } } : {},
  }),
}))
jest.mock('../../src/utils/agent', () => ({ useHekaAgent: () => ({ agent: mockAgent }) }))
jest.mock('../../src/contexts', () => ({ useRootStore: () => ({ passkeysStore: { getUser: async () => 'user-1' } }) }))
jest.mock('../../src/utils/useWalletBackupHelpers', () => ({
  useWalletBackupHelpers: () => ({ backupWallet: mockBackupWallet }),
}))

const makeAgent = () => ({
  dependencyManager: {
    resolve: () => ({
      isStoreOpen: () => true,
      withTransaction: (_context: unknown, callback: (session: string) => unknown) => callback('session'),
    }),
  },
  context: {},
})

const lastProps = (): ProviderProps => mockProvider.mock.calls[mockProvider.mock.calls.length - 1][0]

describe('CryptoHost', () => {
  beforeEach(() => {
    mockAgent = undefined
    mockBackupEnabled = false
    mockRpcOverride = undefined
    jest.clearAllMocks()
  })

  it('reports the agent as not ready until one exists', () => {
    const view = render(<CryptoHost />)
    expect(lastProps().isAgentReady).toBe(false)

    mockAgent = makeAgent()
    view.rerender(<CryptoHost />)
    expect(lastProps().isAgentReady).toBe(true)
  })

  it('refuses a store session while there is no agent', async () => {
    render(<CryptoHost />)
    await expect(lastProps().withSeedSession(async () => 'x')).rejects.toThrow(AskarStoreClosedError)
  })

  it('passes no backup when wallet backup is off', () => {
    render(<CryptoHost />)
    expect(lastProps().backup).toBeUndefined()
  })

  it('backs up with the passkey user when wallet backup is on', async () => {
    mockBackupEnabled = true
    render(<CryptoHost />)

    await lastProps().backup?.backupNow()

    expect(mockBackupWallet).toHaveBeenCalledWith('user-1')
  })

  it('registers Base Sepolia with the configured RPC override', () => {
    mockRpcOverride = 'https://rpc.example/key'
    render(<CryptoHost />)

    const [adapter] = lastProps().createAdapters({ getAddress: jest.fn() })

    expect(lastProps().defaultChainId).toBe('eip155:84532')
    expect(adapter.chain).toMatchObject({ id: 'eip155:84532', rpcUrl: 'https://rpc.example/key' })
  })

  it('lets the provider read the store in its effect when the agent arrives after the first render', async () => {
    const view = render(<CryptoHost />)

    mockAgent = makeAgent()
    view.rerender(<CryptoHost />)

    await expect(mockMountRead.mock.calls[0][0]).resolves.toBe('session')
  })
})
