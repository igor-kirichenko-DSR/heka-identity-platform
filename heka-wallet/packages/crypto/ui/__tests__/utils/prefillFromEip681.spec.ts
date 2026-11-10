import { AdapterRegistry } from '@heka-wallet/crypto-core'

import { PaymentRequestError, prefillFromEip681 } from '../../src/utils/prefillFromEip681'
import { BASE_SEPOLIA, FakeAdapter, makeChain, usdcOn } from '../helpers/services'

const RECIPIENT = '0x1111111111111111111111111111111111111111'
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

const makeRegistry = () => {
  const registry = new AdapterRegistry()
  const chain = makeChain(BASE_SEPOLIA, { assets: [usdcOn(BASE_SEPOLIA)] })
  registry.register(new FakeAdapter(chain))
  return { registry, chain }
}

describe('prefillFromEip681', () => {
  it('fills a native request with the chain in the URI', () => {
    const { registry, chain } = makeRegistry()
    const result = prefillFromEip681(`ethereum:${RECIPIENT}@84532?value=5`, registry, BASE_SEPOLIA)
    expect(result).toEqual({
      chainId: BASE_SEPOLIA,
      prefill: { to: RECIPIENT, assetId: chain.nativeAsset.id, amount: '5' },
    })
  })

  it('fills a token transfer from the contract address', () => {
    const { registry } = makeRegistry()
    const uri = `ethereum:${USDC}@84532/transfer?address=${RECIPIENT}&uint256=2500000`
    const { prefill } = prefillFromEip681(uri, registry, BASE_SEPOLIA)
    expect(prefill).toEqual({ to: RECIPIENT, assetId: usdcOn(BASE_SEPOLIA).id, amount: '2500000' })
  })

  it('uses the current chain when the URI names none', () => {
    const { registry } = makeRegistry()
    expect(prefillFromEip681(`ethereum:${RECIPIENT}`, registry, BASE_SEPOLIA).chainId).toBe(BASE_SEPOLIA)
  })

  it('refuses a chain no adapter handles', () => {
    const { registry } = makeRegistry()
    expect(() => prefillFromEip681(`ethereum:${RECIPIENT}@1`, registry, BASE_SEPOLIA)).toThrow(PaymentRequestError)
  })

  it('refuses a token the chain does not list', () => {
    const { registry } = makeRegistry()
    const uri = `ethereum:0x2222222222222222222222222222222222222222@84532/transfer?address=${RECIPIENT}`
    expect(() => prefillFromEip681(uri, registry, BASE_SEPOLIA)).toThrow(PaymentRequestError)
  })
})
