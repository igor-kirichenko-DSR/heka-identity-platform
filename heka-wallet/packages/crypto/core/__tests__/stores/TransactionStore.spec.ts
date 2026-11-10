import { autorun } from 'mobx'

import {
  type Account,
  AdapterRegistry,
  fromSerializedTxRecord,
  type HistoryPage,
  type KeyProvider,
  LocalLedger,
  MemoryLedgerStorage,
  NotReadyError,
  PendingSendError,
  TransactionStore,
  type TransferRequest,
} from '../../src'
import page1 from '../fixtures/history-base-sepolia-page-1.json'
import page2 from '../fixtures/history-base-sepolia-page-2.json'
import { BASE_SEPOLIA, HEDERA_TESTNET_EVM, makeChain, TEST_PENDING_TIMEOUT_MS, usdcOn } from '../helpers/chains'
import { FakeAdapter } from '../helpers/FakeAdapter'
import { makeLogger } from '../helpers/logger'
import { HOLDER, makeRecord, RECIPIENT, T0 } from '../helpers/records'

const STATUS_POLL_MS = 5_000
const SEND_HASH = '0xaaa0000000000000000000000000000000000000000000000000000000000001'
const USER_OP_HASH = '0xeee0000000000000000000000000000000000000000000000000000000000009'
const BUNDLE_HASH = '0xccc0000000000000000000000000000000000000000000000000000000000003'
/** A pending promise the test resolves itself. */
const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => (resolve = done))
  return { promise, resolve }
}

const account: Account = { chainId: BASE_SEPOLIA, address: HOLDER, index: 0 }

const transferRequest = (from: Account = account): TransferRequest => ({
  from,
  to: RECIPIENT,
  asset: usdcOn(from.chainId),
  amount: BigInt(1500000),
  feeMode: 'native',
})

const fixturePage = (json: { items: unknown[]; next?: string }): HistoryPage => ({
  items: json.items.map(fromSerializedTxRecord),
  next: json.next,
})

const keys = {} as KeyProvider

const setup = (storage = new MemoryLedgerStorage()) => {
  const registry = new AdapterRegistry()
  const base = new FakeAdapter(makeChain(BASE_SEPOLIA))
  const hedera = new FakeAdapter(makeChain(HEDERA_TESTNET_EVM))
  registry.register(base)
  registry.register(hedera)
  const logger = makeLogger()
  const ledger = new LocalLedger(storage, logger)
  const store = new TransactionStore(registry, ledger, keys, logger)
  return { store, ledger, storage, base, hedera, logger }
}

const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms)

describe('TransactionStore', () => {
  const stores: TransactionStore[] = []
  const tracked = (context: ReturnType<typeof setup>) => {
    stores.push(context.store)
    return context
  }
  /** A store whose init() has finished. */
  const ready = async (storage?: MemoryLedgerStorage) => {
    const context = tracked(setup(storage))
    await context.store.init()
    return context
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: T0 })
  })

  afterEach(() => {
    stores.splice(0).forEach((store) => store.dispose())
    jest.useRealTimers()
  })

  describe('submit and status', () => {
    it('stores a submitted send as pending in memory and in the ledger', async () => {
      const { store, ledger, base } = await ready()
      base.transfer.mockResolvedValue({ txId: SEND_HASH })

      const record = await store.submit(transferRequest())

      expect(base.transfer).toHaveBeenCalledWith(transferRequest(), keys)
      expect(record).toMatchObject({
        txId: SEND_HASH,
        explorerHash: SEND_HASH,
        status: 'pending',
        direction: 'out',
        source: 'local',
      })
      expect(await ledger.get(BASE_SEPOLIA, SEND_HASH)).toEqual(record)
      expect(store.historyOf(account)).toEqual([record])
    })

    it.each(['success', 'failed'] as const)('settles a pending send as %s from the status poll', async (final) => {
      const { store, ledger, base } = await ready()
      base.transfer.mockResolvedValue({ txId: SEND_HASH })
      base.getStatus.mockResolvedValueOnce({ status: 'pending' }).mockResolvedValueOnce({ status: final })

      await store.submit(transferRequest())
      await advance(STATUS_POLL_MS)
      expect(store.historyOf(account)[0].status).toBe('pending')
      await advance(STATUS_POLL_MS)

      expect(store.historyOf(account)[0].status).toBe(final)
      expect((await ledger.get(BASE_SEPOLIA, SEND_HASH))?.status).toBe(final)
      await advance(STATUS_POLL_MS * 10)
      expect(base.getStatus).toHaveBeenCalledTimes(2)
    })

    it('marks a send unknown once the chain timeout has passed and stops polling', async () => {
      const { store, ledger, base } = await ready()
      base.transfer.mockResolvedValue({ txId: SEND_HASH })
      base.getStatus.mockResolvedValue({ status: 'pending' })

      await store.submit(transferRequest())
      await advance(TEST_PENDING_TIMEOUT_MS - STATUS_POLL_MS)
      expect(store.historyOf(account)[0].status).toBe('pending')
      await advance(STATUS_POLL_MS)

      expect(store.historyOf(account)[0].status).toBe('unknown')
      expect((await ledger.get(BASE_SEPOLIA, SEND_HASH))?.status).toBe('unknown')
      const calls = base.getStatus.mock.calls.length
      await advance(TEST_PENDING_TIMEOUT_MS)
      expect(base.getStatus).toHaveBeenCalledTimes(calls)
    })

    it('keeps polling after a failed status check', async () => {
      const { store, base, logger } = await ready()
      base.transfer.mockResolvedValue({ txId: SEND_HASH })
      base.getStatus.mockRejectedValueOnce(new Error('rpc down')).mockResolvedValueOnce({ status: 'success' })

      await store.submit(transferRequest())
      await advance(STATUS_POLL_MS * 2)

      expect(logger.warn).toHaveBeenCalledWith('Status check failed', expect.objectContaining({ txId: SEND_HASH }))
      expect(store.historyOf(account)[0].status).toBe('success')
    })

    it('keeps the explorer hash of a user operation apart from its id', async () => {
      const { store, base } = await ready()
      base.transfer.mockResolvedValue({ txId: USER_OP_HASH, explorerHash: BUNDLE_HASH })

      const record = await store.submit(transferRequest())

      expect(record).toMatchObject({ txId: USER_OP_HASH, explorerHash: BUNDLE_HASH })
    })

    it('refuses a send before init() has loaded the ledger', async () => {
      const { store, base } = tracked(setup())

      await expect(store.submit(transferRequest())).rejects.toThrow(NotReadyError)
      expect(base.transfer).not.toHaveBeenCalled()
    })

    it('records the explorer hash and the charged fee that the final status reports', async () => {
      const { store, ledger, base } = await ready()
      const charged = { asset: usdcOn(BASE_SEPOLIA), amount: BigInt(21000) }
      base.transfer.mockResolvedValue({ txId: USER_OP_HASH })
      base.getStatus.mockResolvedValueOnce({ status: 'success', explorerHash: BUNDLE_HASH, fee: charged })

      await store.submit(transferRequest(), {
        mode: 'usdc-paymaster',
        asset: usdcOn(BASE_SEPOLIA),
        amount: BigInt(30000),
        display: '0.03 USDC',
      })
      await advance(STATUS_POLL_MS)

      const expected = { txId: USER_OP_HASH, explorerHash: BUNDLE_HASH, fee: charged, status: 'success' }
      expect(store.historyOf(account)[0]).toMatchObject(expected)
      expect(await ledger.get(BASE_SEPOLIA, USER_OP_HASH)).toMatchObject(expected)
    })

    it('does not overwrite a send that history settled while a status check was in flight', async () => {
      const { store, ledger, base } = await ready()
      base.transfer.mockResolvedValue({ txId: SEND_HASH })
      const check = deferred<{ status: 'pending' }>()
      base.getStatus.mockReturnValueOnce(check.promise)
      await store.submit(transferRequest())
      await advance(STATUS_POLL_MS)
      expect(base.getStatus).toHaveBeenCalledTimes(1)

      base.getHistory.mockResolvedValueOnce(fixturePage(page1))
      await store.loadHistory(account)
      expect(store.historyOf(account).find((record) => record.txId === SEND_HASH)?.status).toBe('success')
      await advance(TEST_PENDING_TIMEOUT_MS)
      check.resolve({ status: 'pending' })
      await advance(0)

      expect(store.historyOf(account).find((record) => record.txId === SEND_HASH)?.status).toBe('success')
      expect((await ledger.get(BASE_SEPOLIA, SEND_HASH))?.status).toBe('success')
      expect(base.getStatus).toHaveBeenCalledTimes(1)
    })

    it('stops status polling on dispose', async () => {
      const { store, base } = await ready()
      base.transfer.mockResolvedValue({ txId: SEND_HASH })
      base.getStatus.mockResolvedValue({ status: 'pending' })
      await store.submit(transferRequest())

      store.dispose()
      await advance(TEST_PENDING_TIMEOUT_MS)

      expect(base.getStatus).not.toHaveBeenCalled()
      expect(store.historyOf(account)[0].status).toBe('pending')
    })

    it('keeps a sent transfer when the ledger write fails', async () => {
      const storage = new MemoryLedgerStorage()
      jest.spyOn(storage, 'put').mockRejectedValueOnce(new Error('store closed'))
      const { store, base, logger } = await ready(storage)
      base.transfer.mockResolvedValue({ txId: SEND_HASH })

      const record = await store.submit(transferRequest())

      expect(store.historyOf(account)).toEqual([record])
      expect(store.ledgerError).toEqual(new Error('store closed'))
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('one pending send per account and chain', () => {
    it('refuses a second send while the first is pending', async () => {
      const { store, base } = await ready()
      base.transfer.mockResolvedValue({ txId: SEND_HASH })
      base.getStatus.mockResolvedValue({ status: 'pending' })
      await store.submit(transferRequest())

      await expect(store.submit(transferRequest())).rejects.toThrow(PendingSendError)
      expect(base.transfer).toHaveBeenCalledTimes(1)
    })

    it('refuses a second send while the first is still being submitted', async () => {
      const { store, base } = await ready()
      let finish: (value: { txId: string }) => void = () => undefined
      base.transfer.mockReturnValue(new Promise((resolve) => (finish = resolve)))

      const first = store.submit(transferRequest())
      await expect(store.submit(transferRequest())).rejects.toThrow(PendingSendError)
      finish({ txId: SEND_HASH })
      await first
    })

    it('allows a send again once the previous one is final', async () => {
      const { store, base } = await ready()
      base.transfer.mockResolvedValueOnce({ txId: SEND_HASH }).mockResolvedValueOnce({ txId: '0x02' })
      base.getStatus.mockResolvedValue({ status: 'success' })
      await store.submit(transferRequest())
      await advance(STATUS_POLL_MS)

      await expect(store.submit(transferRequest())).resolves.toMatchObject({ txId: '0x02' })
    })

    it('allows a send on another chain while one is pending', async () => {
      const { store, base, hedera } = await ready()
      base.transfer.mockResolvedValue({ txId: SEND_HASH })
      base.getStatus.mockResolvedValue({ status: 'pending' })
      hedera.transfer.mockResolvedValue({ txId: SEND_HASH })
      hedera.getStatus.mockResolvedValue({ status: 'pending' })
      await store.submit(transferRequest())

      await expect(store.submit(transferRequest({ ...account, chainId: HEDERA_TESTNET_EVM }))).resolves.toMatchObject({
        chainId: HEDERA_TESTNET_EVM,
      })
    })

    it('reports a send in flight to observers and clears it when the submit fails', async () => {
      const { store, base } = await ready()
      const transfer = deferred<{ txId: string }>()
      base.transfer.mockReturnValueOnce(transfer.promise.then(() => Promise.reject(new Error('rejected by node'))))
      const seen: boolean[] = []
      const stop = autorun(() => seen.push(store.hasPendingSend(account)))

      const sending = store.submit(transferRequest())
      transfer.resolve({ txId: SEND_HASH })
      await expect(sending).rejects.toThrow('rejected by node')
      stop()

      expect(seen).toEqual([false, true, false])
    })

    it('treats a checksummed address as the same account', async () => {
      const { store, base } = await ready()
      base.transfer.mockResolvedValue({ txId: SEND_HASH })
      base.getStatus.mockResolvedValue({ status: 'pending' })
      await store.submit(transferRequest())

      expect(store.hasPendingSend({ ...account, address: HOLDER.toUpperCase().replace('0X', '0x') })).toBe(true)
    })
  })

  describe('history merge (recorded fixtures)', () => {
    it('shows a send that is also in chain history once and settles it from the chain status', async () => {
      const { store, ledger, base } = tracked(setup())
      await ledger.put(makeRecord({ txId: SEND_HASH, explorerHash: SEND_HASH, createdAt: T0 }))
      base.getStatus.mockResolvedValue({ status: 'pending' })
      await store.init()
      base.getHistory.mockResolvedValueOnce(fixturePage(page1))

      await store.loadHistory(account)

      const history = store.historyOf(account)
      expect(history.filter((record) => record.txId.toLowerCase() === SEND_HASH)).toHaveLength(1)
      expect(history.find((record) => record.txId === SEND_HASH)).toMatchObject({ status: 'success', source: 'local' })
      expect((await ledger.get(BASE_SEPOLIA, SEND_HASH))?.status).toBe('success')
    })

    it('settles a send that timed out as unknown once history reports it final', async () => {
      const { store, ledger, base } = tracked(setup())
      await ledger.put(makeRecord({ txId: SEND_HASH, explorerHash: SEND_HASH, status: 'unknown', createdAt: T0 }))
      await store.init()
      base.getHistory.mockResolvedValueOnce(fixturePage(page1))

      await store.loadHistory(account)

      expect(store.historyOf(account).find((record) => record.txId === SEND_HASH)?.status).toBe('success')
      expect((await ledger.get(BASE_SEPOLIA, SEND_HASH))?.status).toBe('success')
      expect(base.getStatus).not.toHaveBeenCalled()
    })

    it('matches a user operation by its explorer hash', async () => {
      const { store, ledger, base } = tracked(setup())
      await ledger.put(
        makeRecord({ txId: USER_OP_HASH, explorerHash: BUNDLE_HASH, amount: BigInt(10000), createdAt: T0 })
      )
      base.getStatus.mockResolvedValue({ status: 'pending' })
      await store.init()
      base.getHistory.mockResolvedValueOnce(fixturePage(page1))

      await store.loadHistory(account)

      const history = store.historyOf(account)
      expect(history.filter((record) => [USER_OP_HASH, BUNDLE_HASH].includes(record.txId))).toEqual([
        expect.objectContaining({ txId: USER_OP_HASH, status: 'failed', source: 'local' }),
      ])
    })

    it('pages by cursor, drops a repeated chain item and sorts newest first', async () => {
      const { store, base } = tracked(setup())
      await store.init()
      base.getHistory.mockResolvedValueOnce(fixturePage(page1)).mockResolvedValueOnce(fixturePage(page2))

      await store.loadHistory(account)
      expect(store.historyStateOf(account)).toMatchObject({ hasMore: true, next: 'cursor-2' })
      await store.loadMoreHistory(account)

      expect(base.getHistory).toHaveBeenNthCalledWith(2, account, 'cursor-2')
      expect(store.historyStateOf(account).hasMore).toBe(false)
      const history = store.historyOf(account)
      expect(history.map((record) => record.txId.slice(0, 5).toLowerCase())).toEqual([
        '0xaaa',
        '0xbbb',
        '0xccc',
        '0xddd',
      ])
      expect(history.every((record) => record.source === 'chain')).toBe(true)

      await store.loadMoreHistory(account)
      expect(base.getHistory).toHaveBeenCalledTimes(2)
    })

    it('keeps a failed history page in state and logs it', async () => {
      const { store, base, logger } = tracked(setup())
      base.getHistory.mockRejectedValueOnce(new Error('rpc down'))

      await store.loadHistory(account)

      expect(store.historyStateOf(account)).toMatchObject({ isLoading: false, error: new Error('rpc down') })
      expect(logger.warn).toHaveBeenCalledWith(
        'History page failed',
        expect.objectContaining({ chainId: BASE_SEPOLIA })
      )
    })
  })

  describe('restart', () => {
    it('shows a pending send written before the app was killed and resolves it after restart', async () => {
      const storage = new MemoryLedgerStorage()
      const before = await ready(storage)
      before.base.transfer.mockResolvedValue({ txId: SEND_HASH })
      before.base.getStatus.mockResolvedValue({ status: 'pending' })
      await before.store.submit(transferRequest())
      before.store.dispose()

      const after = tracked(setup(storage))
      after.base.getStatus.mockResolvedValue({ status: 'success' })
      await after.store.init()
      expect(after.store.historyOf(account)).toEqual([expect.objectContaining({ txId: SEND_HASH, status: 'pending' })])

      await advance(0)

      expect(after.base.getStatus).toHaveBeenCalledWith(SEND_HASH)
      expect(after.store.historyOf(account)[0].status).toBe('success')
      expect((await after.ledger.get(BASE_SEPOLIA, SEND_HASH))?.status).toBe('success')
    })

    it('resolves a resumed send that is past its timeout as unknown after one last status check', async () => {
      const storage = new MemoryLedgerStorage()
      await new LocalLedger(storage, makeLogger()).put(makeRecord({ createdAt: T0 - TEST_PENDING_TIMEOUT_MS * 2 }))
      const { store, base } = tracked(setup(storage))
      base.getStatus.mockResolvedValue({ status: 'pending' })

      await store.init()
      await advance(0)

      expect(base.getStatus).toHaveBeenCalledTimes(1)
      expect(store.historyOf(account)[0].status).toBe('unknown')
    })

    it('does not poll a pending send whose chain is no longer registered', async () => {
      const storage = new MemoryLedgerStorage()
      await new LocalLedger(storage, makeLogger()).put(makeRecord({ chainId: 'eip155:1' }))
      const { store, logger } = tracked(setup(storage))

      await store.init()

      expect(logger.warn).toHaveBeenCalledWith(
        'Pending send on an unregistered chain is not polled',
        expect.objectContaining({ chainId: 'eip155:1' })
      )
    })
  })

  describe('known recipients', () => {
    it('knows a recipient of an own send, in any letter case', async () => {
      const storage = new MemoryLedgerStorage()
      await new LocalLedger(storage, makeLogger()).put(makeRecord({ status: 'success' }))
      const { store } = await ready(storage)

      expect(store.isKnownRecipient(account, RECIPIENT.toUpperCase().replace('0X', '0x'))).toBe(true)
    })

    it('does not know an address this account never sent to', async () => {
      const { store } = await ready()

      expect(store.isKnownRecipient(account, RECIPIENT)).toBe(false)
    })

    it('does not count a send from another account or chain', async () => {
      const storage = new MemoryLedgerStorage()
      const ledger = new LocalLedger(storage, makeLogger())
      await ledger.put(makeRecord({ status: 'success', account: RECIPIENT, counterparty: HOLDER }))
      await ledger.put(makeRecord({ status: 'success', chainId: HEDERA_TESTNET_EVM, txId: '0xbbb' }))
      const { store } = await ready(storage)

      expect(store.isKnownRecipient(account, HOLDER)).toBe(false)
      expect(store.isKnownRecipient(account, RECIPIENT)).toBe(false)
    })
  })
})
