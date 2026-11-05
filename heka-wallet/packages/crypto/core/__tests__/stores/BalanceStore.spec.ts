import { AccountStore, AdapterRegistry, BalanceStore } from '../../src'
import { BASE_SEPOLIA, HEDERA_TESTNET_EVM, makeChain } from '../helpers/chains'
import { FakeAdapter } from '../helpers/FakeAdapter'
import { makeLogger } from '../helpers/logger'
import { HOLDER } from '../helpers/records'

const SECOND = 1_000

/** A getBalances call the test answers itself. */
const deferred = () => {
  let resolve: (value: Record<string, bigint>) => void = () => undefined
  let reject: (error: Error) => void = () => undefined
  const promise = new Promise<Record<string, bigint>>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

const setup = async () => {
  const registry = new AdapterRegistry()
  const base = new FakeAdapter(makeChain(BASE_SEPOLIA))
  const hedera = new FakeAdapter(makeChain(HEDERA_TESTNET_EVM))
  registry.register(base)
  registry.register(hedera)
  base.getBalances.mockResolvedValue({ [base.chain.assets[0].id]: BigInt(5) })
  hedera.getBalances.mockResolvedValue({})
  const logger = makeLogger()
  const accounts = new AccountStore(registry, { getAddress: async () => HOLDER }, logger)
  await accounts.load()
  const store = new BalanceStore(registry, accounts, logger)
  return { store, accounts, base, hedera, logger }
}

/** Advances fake time and lets the resulting promises settle. */
const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms)

describe('BalanceStore', () => {
  let stores: BalanceStore[] = []

  beforeEach(() => {
    jest.useFakeTimers()
    stores = []
  })

  afterEach(() => {
    stores.forEach((store) => store.dispose())
    jest.useRealTimers()
  })

  const started = async () => {
    const context = await setup()
    stores.push(context.store)
    context.store.start()
    await advance(0)
    return context
  }

  it('polls at once, then after 10, 20, 40, 80 s and every 120 s after that', async () => {
    const { base } = await started()
    expect(base.getBalances).toHaveBeenCalledTimes(1)

    const expectedGaps = [10, 20, 40, 80, 120, 120]
    for (const [i, gap] of expectedGaps.entries()) {
      await advance(gap * SECOND - 1)
      expect(base.getBalances).toHaveBeenCalledTimes(i + 1)
      await advance(1)
      expect(base.getBalances).toHaveBeenCalledTimes(i + 2)
    }
  })

  it('asks for the native asset and the chain assets of the current account', async () => {
    const { base, store } = await started()

    expect(base.getBalances).toHaveBeenCalledWith({ chainId: BASE_SEPOLIA, address: HOLDER, index: 0 }, [
      base.chain.nativeAsset,
      ...base.chain.assets,
    ])
    expect(store.balancesOf({ chainId: BASE_SEPOLIA, address: HOLDER, index: 0 })).toEqual({
      [base.chain.assets[0].id]: BigInt(5),
    })
  })

  it.each([
    ['foreground', (store: BalanceStore) => store.onForeground()],
    ['pull-to-refresh', (store: BalanceStore) => void store.refresh()],
    ['a send', (store: BalanceStore) => store.notifySent()],
  ])('resets the interval to 10 s on %s', async (_case, trigger) => {
    const { base, store } = await started()
    await advance(10 * SECOND)
    await advance(20 * SECOND)
    expect(base.getBalances).toHaveBeenCalledTimes(3)

    trigger(store)
    await advance(0)
    expect(base.getBalances).toHaveBeenCalledTimes(4)

    await advance(10 * SECOND)
    expect(base.getBalances).toHaveBeenCalledTimes(5)
  })

  it('does not poll while locked and starts again at once on unlock', async () => {
    const { base, store } = await started()

    store.setLocked(true)
    await advance(10 * 60 * SECOND)
    expect(base.getBalances).toHaveBeenCalledTimes(1)

    store.setLocked(false)
    await advance(0)
    expect(base.getBalances).toHaveBeenCalledTimes(2)
    await advance(10 * SECOND)
    expect(base.getBalances).toHaveBeenCalledTimes(3)
  })

  it('does not poll before start or after stop', async () => {
    const context = await setup()
    stores.push(context.store)
    context.store.onForeground()
    await advance(60 * SECOND)
    expect(context.base.getBalances).not.toHaveBeenCalled()

    context.store.start()
    await advance(0)
    context.store.stop()
    await advance(10 * 60 * SECOND)
    expect(context.base.getBalances).toHaveBeenCalledTimes(1)
  })

  it('keeps a failed poll in error state, logs it and keeps polling', async () => {
    const context = await setup()
    stores.push(context.store)
    context.base.getBalances.mockRejectedValueOnce(new Error('rpc down'))

    context.store.start()
    await advance(0)
    expect(context.store.error).toEqual(new Error('rpc down'))
    expect(context.logger.warn).toHaveBeenCalledWith(
      'Balance poll failed',
      expect.objectContaining({ chainId: BASE_SEPOLIA })
    )

    await advance(10 * SECOND)
    expect(context.base.getBalances).toHaveBeenCalledTimes(2)
    expect(context.store.error).toBeUndefined()
  })

  it('polls the new chain at once when the current account changes', async () => {
    const { accounts, hedera } = await started()

    accounts.setChain(HEDERA_TESTNET_EVM)
    await advance(0)

    expect(hedera.getBalances).toHaveBeenCalledTimes(1)
  })

  it('keeps one poll chain when a reset comes while a poll is in flight', async () => {
    const { base, store } = await started()
    const slow = deferred()
    base.getBalances.mockReturnValueOnce(slow.promise)
    await advance(10 * SECOND)
    expect(base.getBalances).toHaveBeenCalledTimes(2)

    await store.refresh()
    expect(base.getBalances).toHaveBeenCalledTimes(3)
    slow.resolve({})
    await advance(0)

    for (const [i, gap] of [10, 20, 40].entries()) {
      await advance(gap * SECOND - 1)
      expect(base.getBalances).toHaveBeenCalledTimes(3 + i)
      await advance(1)
      expect(base.getBalances).toHaveBeenCalledTimes(4 + i)
    }
  })

  it('stays loading until the newest poll ends, even when an older one ends first', async () => {
    const { base, store } = await started()
    const older = deferred()
    const newer = deferred()
    base.getBalances.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    await advance(10 * SECOND)
    const refreshing = store.refresh()
    expect(store.isLoading).toBe(true)

    older.resolve({})
    await advance(0)
    expect(store.isLoading).toBe(true)

    newer.resolve({})
    await refreshing
    expect(store.isLoading).toBe(false)
  })

  it('does not show the old chain error after a chain switch', async () => {
    const { accounts, base, store } = await started()
    const older = deferred()
    base.getBalances.mockReturnValueOnce(older.promise)
    await advance(10 * SECOND)

    accounts.setChain(HEDERA_TESTNET_EVM)
    await advance(0)
    older.reject(new Error('base rpc down'))
    await advance(0)

    expect(store.error).toBeUndefined()
    expect(store.isLoading).toBe(false)
  })

  it('stops polling and following account changes on dispose', async () => {
    const { accounts, base, hedera, store } = await started()

    store.dispose()
    accounts.setChain(HEDERA_TESTNET_EVM)
    await advance(10 * 60 * SECOND)

    expect(base.getBalances).toHaveBeenCalledTimes(1)
    expect(hedera.getBalances).not.toHaveBeenCalled()
  })
})
