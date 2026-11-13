import type {
  Account,
  AddressValidation,
  AssetDescriptor,
  AssetId,
  ChainAdapter,
  ChainDescriptor,
  FeeQuote,
  HistoryPage,
  StatusResult,
  TransferRequest,
  TransferResult,
} from '../../src'

/** A ChainAdapter whose network calls are jest mocks; tests set their results. */
export class FakeAdapter implements ChainAdapter {
  deriveAccount = jest.fn<Promise<Account>, [unknown, number]>()
  validateAddress = jest.fn<AddressValidation, [string]>((input) => ({ ok: true, normalized: input }))
  getBalances = jest.fn<Promise<Record<AssetId, bigint>>, [Account, AssetDescriptor[]]>()
  estimateFee = jest.fn<Promise<FeeQuote>, [TransferRequest]>()
  transfer = jest.fn<Promise<TransferResult>, [TransferRequest, unknown]>()
  getStatus = jest.fn<Promise<StatusResult>, [string]>()
  getHistory = jest.fn<Promise<HistoryPage>, [Account, string | undefined]>()

  constructor(readonly chain: ChainDescriptor) {}
}
