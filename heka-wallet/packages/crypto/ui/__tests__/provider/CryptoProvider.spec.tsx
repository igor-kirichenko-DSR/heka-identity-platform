import type { CryptoServices } from '../../src/provider/createCryptoServices'

import { act, render, waitFor } from '@testing-library/react-native'
import React from 'react'

import { useCrypto } from '../../src/provider/CryptoContext'
import { CryptoProvider } from '../../src/provider/CryptoProvider'
import { FakeSeedSession } from '../../../core/__tests__/helpers/seedSession'
import { bifoldState } from '../helpers/mocks'
import { BASE_SEPOLIA, FakeAdapter, makeChain, MemoryChainPreference, OTHER_MNEMONIC } from '../helpers/services'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())

const HEDERA_EVM = 'eip155:296'

/** One in-memory Askar table for the seed and the ledger; the ledger also lists a category. */
class FakeSession extends FakeSeedSession {
  fetchAll = jest.fn(async ({ category }: { category: string }) =>
    [...this.rows.values()].filter((row) => row.category === category)
  )
}

const setup = (options: { saved?: string; isAgentReady?: boolean } = {}) => {
  const session = new FakeSession()
  const withSession = <T,>(callback: (s: FakeSession) => Promise<T>) => callback(session)
  const adapters = [new FakeAdapter(makeChain(BASE_SEPOLIA)), new FakeAdapter(makeChain(HEDERA_EVM))]
  const chainPreference = new MemoryChainPreference(options.saved as never)
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const captured: { services?: CryptoServices } = {}
  const Probe = () => {
    captured.services = useCrypto()
    return null
  }
  const element = (isAgentReady = options.isAgentReady ?? true) => (
    <CryptoProvider
      adapters={adapters}
      withSeedSession={withSession}
      withLedgerSession={withSession}
      logger={logger}
      defaultChainId={BASE_SEPOLIA}
      chainPreference={chainPreference}
      isAgentReady={isAgentReady}
    >
      <Probe />
    </CryptoProvider>
  )
  const view = render(element())
  const services = () => {
    if (!captured.services) throw new Error('Provider did not render')
    return captured.services
  }
  return { view, element, services, chainPreference, session, adapters }
}

/** A promise the test settles itself. */
const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => (resolve = done))
  return { promise, resolve }
}

const setLocked = (
  view: ReturnType<typeof setup>['view'],
  element: ReturnType<typeof setup>['element'],
  locked: boolean
) => {
  bifoldState.authentication.didAuthenticate = !locked
  view.rerender(element())
}

describe('CryptoProvider', () => {
  beforeEach(() => {
    bifoldState.authentication.didAuthenticate = true
  })

  it('unlocks the keys and loads the wallet status once the identity wallet is open', async () => {
    const { services } = setup()

    await waitFor(() => expect(services().wallet.status).toBe('none'))
    expect(services().keys.isLocked).toBe(false)
    expect(services().transactions.isInitialized).toBe(true)
  })

  it('locks keys and balance polling when the identity wallet locks, and reloads after authentication', async () => {
    const { view, element, services, adapters } = setup()
    await waitFor(() => expect(services().wallet.status).toBe('none'))
    adapters[0].getBalances.mockResolvedValue({})
    await act(() => services().wallet.importPhrase(OTHER_MNEMONIC))
    await waitFor(() => expect(adapters[0].getBalances).toHaveBeenCalled())
    const hasSeed = jest.spyOn(services().keys, 'hasSeed')

    setLocked(view, element, true)
    adapters[0].getBalances.mockClear()
    await act(async () => services().balances.onForeground())
    expect(services().keys.isLocked).toBe(true)
    expect(adapters[0].getBalances).not.toHaveBeenCalled()

    setLocked(view, element, false)
    await waitFor(() => expect(adapters[0].getBalances).toHaveBeenCalled())
    expect(services().keys.isLocked).toBe(false)
    expect(hasSeed).toHaveBeenCalled()
  })

  it('does not resume polling when the wallet locks while it is still opening', async () => {
    const { view, element, services, adapters, chainPreference } = setup()
    await waitFor(() => expect(services().wallet.status).toBe('none'))
    adapters[0].getBalances.mockResolvedValue({})
    await act(() => services().wallet.importPhrase(OTHER_MNEMONIC))
    setLocked(view, element, true)
    const pending = deferred<undefined>()
    chainPreference.get.mockReturnValueOnce(pending.promise)

    setLocked(view, element, false)
    await waitFor(() => expect(chainPreference.get).toHaveBeenCalledTimes(2))
    setLocked(view, element, true)
    await act(async () => pending.resolve(undefined))
    adapters[0].getBalances.mockClear()
    await act(async () => services().balances.onForeground())

    expect(services().keys.isLocked).toBe(true)
    expect(adapters[0].getBalances).not.toHaveBeenCalled()
  })

  it('reads the ledger again on the next unlock when the first read failed', async () => {
    const { view, element, services, session } = setup()
    session.fetchAll.mockRejectedValueOnce(new Error('store closed'))
    await waitFor(() => expect(services().transactions.ledgerError).toBeDefined())

    setLocked(view, element, true)
    setLocked(view, element, false)

    await waitFor(() => expect(session.fetchAll).toHaveBeenCalledTimes(2))
    setLocked(view, element, true)
    setLocked(view, element, false)
    await waitFor(() => expect(services().keys.isLocked).toBe(false))
    await act(async () => undefined)
    expect(session.fetchAll).toHaveBeenCalledTimes(2)
  })

  it('stays locked and reads nothing while the agent is not ready', async () => {
    const { services } = setup({ isAgentReady: false })

    await act(async () => undefined)

    expect(services().keys.isLocked).toBe(true)
    expect(services().wallet.status).toBe('loading')
  })

  it('selects the saved default chain', async () => {
    const { services } = setup({ saved: HEDERA_EVM })

    await waitFor(() => expect(services().accounts.currentChainId).toBe(HEDERA_EVM))
  })

  it('falls back to the app default when the saved chain is not registered', async () => {
    const { services } = setup({ saved: 'eip155:1' })

    await waitFor(() => expect(services().wallet.status).toBe('none'))
    expect(services().accounts.currentChainId).toBe(BASE_SEPOLIA)
  })

  it('locks the keys and stops the stores on unmount', async () => {
    const { view, services } = setup()
    await waitFor(() => expect(services().wallet.status).toBe('none'))
    const disposeBalances = jest.spyOn(services().balances, 'dispose')
    const disposeTransactions = jest.spyOn(services().transactions, 'dispose')

    view.unmount()

    expect(services().keys.isLocked).toBe(true)
    expect(disposeBalances).toHaveBeenCalled()
    expect(disposeTransactions).toHaveBeenCalled()
  })
})
