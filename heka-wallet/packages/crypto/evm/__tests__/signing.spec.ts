import type { AuthProofIssuer, SigningBranch, SigningRequest } from '@heka-wallet/crypto-core'

import {
  AuthProofError,
  KeyLockedError,
  MemorySeedStorage,
  SeedKeyProvider,
  SigningRequestError,
} from '@heka-wallet/crypto-core'
import { recoverMessageAddress, recoverTypedDataAddress } from 'viem'
import { parseSiweMessage, validateSiweMessage } from 'viem/siwe'

import { baseSepolia, buildSiweMessage, EvmAdapter } from '../src'

import { USDC_ADDRESS } from './helpers/chain'
import { createRpcMock } from './helpers/rpc'

// Generated for tests only; holds no funds (same phrase as the core key tests).
const MNEMONIC = 'wave wonder voice way faculty naive luggage abandon dilemma luxury target mistake'
const REQUEST_URL = 'https://rp.example.com/sign/abc'
const NOW = Date.parse('2026-11-13T10:00:00Z')
const CHAIN = 'eip155:84532'

const typedData = {
  domain: {
    name: 'Login',
    version: '1',
    chainId: 84532,
    verifyingContract: '0x1111111111111111111111111111111111111111',
  },
  types: {
    Login: [
      { name: 'nonce', type: 'string' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'Party' },
    ],
    Party: [{ name: 'wallet', type: 'address' }],
  },
  primaryType: 'Login',
  message: { nonce: 'n1', amount: '42', to: { wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' } },
}

const siwePayload = {
  domain: 'rp.example.com',
  uri: 'https://rp.example.com/login',
  chainId: 84532,
  nonce: 'abcdefgh1234',
  statement: 'Sign in to RP',
  issuedAt: '2026-11-13T09:59:00Z',
  expirationTime: '2026-11-13T10:30:00Z',
}

const make = (branch: SigningBranch, kind: SigningRequest['kind'], payload: unknown): SigningRequest =>
  ({
    version: 1,
    id: 'req-1',
    kind,
    chain: CHAIN,
    branch,
    payload,
    responseUri: 'https://rp.example.com/sign/abc/response',
    expiresAt: '2026-11-13T10:05:00Z',
  }) as SigningRequest

const setup = async () => {
  const provider = new SeedKeyProvider({ storage: new MemorySeedStorage() })
  provider.unlock()
  const issuer: AuthProofIssuer = provider.createAuthProofIssuer()
  await provider.importSeed(MNEMONIC)
  const adapter = new EvmAdapter({
    config: baseSepolia,
    addressBook: provider,
    transport: createRpcMock({}).transport,
  })
  return { provider, issuer, adapter }
}

const codeOf = (run: () => unknown): string | undefined => {
  try {
    run()
  } catch (error) {
    return error instanceof SigningRequestError ? error.code : 'other'
  }
  return undefined
}

describe('EVM signing requests', () => {
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW))
  afterEach(() => jest.restoreAllMocks())

  describe.each(['payment', 'binding'] as const)('on the %s branch', (branch) => {
    it('signs a nonce that recovers to the branch address', async () => {
      const { provider, issuer, adapter } = await setup()
      const request = make(branch, 'personal_sign', { message: 'nonce-123' })

      const { address, signature } = await adapter.signRequest(
        request,
        { requestUrl: REQUEST_URL },
        provider,
        issuer.issue()
      )

      expect(address).toBe(await adapter.signingAddress(request))
      await expect(
        recoverMessageAddress({ message: 'nonce-123', signature: signature as `0x${string}` })
      ).resolves.toBe(address)
    })

    it('signs typed data with integers as strings', async () => {
      const { provider, issuer, adapter } = await setup()
      const request = make(branch, 'eip712', typedData)

      const { address, signature } = await adapter.signRequest(
        request,
        { requestUrl: REQUEST_URL },
        provider,
        issuer.issue()
      )

      const recovered = await recoverTypedDataAddress({
        domain: { ...typedData.domain, verifyingContract: typedData.domain.verifyingContract as `0x${string}` },
        types: typedData.types,
        primaryType: 'Login',
        message: { nonce: 'n1', amount: BigInt(42), to: { wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' } },
        signature: signature as `0x${string}`,
      })
      expect(recovered).toBe(address)
    })

    it('signs the SIWE text the relying party rebuilds from the same fields', async () => {
      const { provider, issuer, adapter } = await setup()
      const request = make(branch, 'siwe', siwePayload)

      const { address, signature } = await adapter.signRequest(
        request,
        { requestUrl: REQUEST_URL },
        provider,
        issuer.issue()
      )

      const message = buildSiweMessage(siwePayload, address as `0x${string}`)
      await expect(recoverMessageAddress({ message, signature: signature as `0x${string}` })).resolves.toBe(address)
      const parsed = parseSiweMessage(message)
      expect(
        validateSiweMessage({
          message: parsed,
          domain: 'rp.example.com',
          address: address as `0x${string}`,
          time: new Date(NOW),
        })
      ).toBe(true)
    })
  })

  it('signs with different addresses on the two branches', async () => {
    const { adapter } = await setup()

    const payment = await adapter.signingAddress(make('payment', 'personal_sign', { message: 'x' }))
    const binding = await adapter.signingAddress(make('binding', 'personal_sign', { message: 'x' }))

    expect(payment).not.toBe(binding)
  })

  describe('refusals', () => {
    const check = (request: SigningRequest, adapter: EvmAdapter, url = REQUEST_URL) =>
      codeOf(() => adapter.checkSigningRequest(request, { requestUrl: url }))

    it('refuses a request for another chain', async () => {
      const { adapter } = await setup()
      const request = { ...make('binding', 'personal_sign', { message: 'x' }), chain: 'eip155:8453' } as SigningRequest

      expect(check(request, adapter)).toBe('chain-mismatch')
    })

    it('refuses typed data whose domain chain differs or is missing', async () => {
      const { adapter } = await setup()
      const other = { ...typedData, domain: { ...typedData.domain, chainId: 1 } }
      const none = { ...typedData, domain: { name: 'Login' } }

      expect(check(make('binding', 'eip712', other), adapter)).toBe('chain-mismatch')
      expect(check(make('binding', 'eip712', none), adapter)).toBe('chain-mismatch')
    })

    it('refuses SIWE for another site, another chain or an expired message', async () => {
      const { adapter } = await setup()

      expect(check(make('binding', 'siwe', { ...siwePayload, domain: 'evil.example.com' }), adapter)).toBe(
        'siwe-domain'
      )
      expect(check(make('binding', 'siwe', { ...siwePayload, chainId: 1 }), adapter)).toBe('chain-mismatch')
      expect(check(make('binding', 'siwe', { ...siwePayload, expirationTime: '2026-11-13T09:00:00Z' }), adapter)).toBe(
        'expired'
      )
      expect(check(make('binding', 'siwe', { ...siwePayload, issuedAt: undefined }), adapter)).toBe('invalid-request')
    })

    it.each(['Permit', 'PermitSingle', 'Permit2', 'PermitBatchTransferFrom'])(
      'refuses typed data with the primary type %s on both branches',
      async (primaryType) => {
        const { adapter } = await setup()
        const permit = {
          domain: { name: 'USD Coin', chainId: 84532 },
          types: { [primaryType]: [{ name: 'spender', type: 'address' }] },
          primaryType,
          message: { spender: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
        }

        expect(check(make('binding', 'eip712', permit), adapter)).toBe('permit-refused')
        expect(check(make('payment', 'eip712', permit), adapter)).toBe('permit-refused')
      }
    )

    it('refuses typed data addressed to a token of the registry, whatever it is called', async () => {
      const { adapter } = await setup()
      const hidden = {
        ...typedData,
        domain: { ...typedData.domain, verifyingContract: USDC_ADDRESS.toLowerCase() },
      }

      expect(check(make('binding', 'eip712', hidden), adapter)).toBe('permit-refused')
    })

    it('allows a plain login typed-data message', async () => {
      const { adapter } = await setup()

      expect(check(make('binding', 'eip712', typedData), adapter)).toBeUndefined()
    })

    it('does not open the key when a check fails', async () => {
      const { provider, issuer, adapter } = await setup()
      const open = jest.spyOn(provider, 'withAuthorizedAccount')
      const request = make('binding', 'siwe', { ...siwePayload, domain: 'evil.example.com' })

      await expect(
        adapter.signRequest(request, { requestUrl: REQUEST_URL }, provider, issuer.issue())
      ).rejects.toMatchObject({
        code: 'siwe-domain',
      })
      expect(open).not.toHaveBeenCalled()
    })

    it('refuses a SIWE message that names another address than the signer', async () => {
      const { provider, issuer, adapter } = await setup()
      const request = make('binding', 'siwe', { ...siwePayload, address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' })

      await expect(
        adapter.signRequest(request, { requestUrl: REQUEST_URL }, provider, issuer.issue())
      ).rejects.toMatchObject({
        code: 'invalid-request',
      })
    })

    it('refuses to sign without a fresh proof, and while locked', async () => {
      const { provider, issuer, adapter } = await setup()
      const request = make('binding', 'personal_sign', { message: 'x' })
      const proof = issuer.issue()
      await adapter.signRequest(request, { requestUrl: REQUEST_URL }, provider, proof)

      await expect(adapter.signRequest(request, { requestUrl: REQUEST_URL }, provider, proof)).rejects.toThrow(
        AuthProofError
      )
      provider.lock()
      await expect(adapter.signRequest(request, { requestUrl: REQUEST_URL }, provider, issuer.issue())).rejects.toThrow(
        KeyLockedError
      )
    })

    it('reports a missing binding account for a wallet imported from one key', async () => {
      const provider = new SeedKeyProvider({ storage: new MemorySeedStorage() })
      provider.unlock()
      await provider.importRawKey('0x5f9590f976115289df984b1a77ffe6dc1e8bd8b1594fa98b4d0d19225337ba6e')
      const adapter = new EvmAdapter({
        config: baseSepolia,
        addressBook: provider,
        transport: createRpcMock({}).transport,
      })

      await expect(adapter.signingAddress(make('binding', 'personal_sign', { message: 'x' }))).rejects.toMatchObject({
        code: 'binding-unavailable',
      })
    })
  })
})
