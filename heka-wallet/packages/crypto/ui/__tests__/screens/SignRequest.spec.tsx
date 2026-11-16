import { SigningRequestError } from '@heka-wallet/crypto-core'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import React from 'react'

import { SignRequest } from '../../src/screens/SignRequest'
import { navigation, screenProps } from '../helpers/navigation'
import { BASE_SEPOLIA, makeServices, renderWithServices, type TestServices } from '../helpers/services'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../helpers/mocks').i18nMock())
jest.mock('@bifold/core/src/components/animated/ButtonLoading', () => require('../helpers/mocks').buttonLoadingMock())

const REQUEST_URL = 'https://rp.example.com/sign/abc'
const ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const FAR_FUTURE = '2999-01-01T00:00:00Z'

const base = (extra: Record<string, unknown> = {}) => ({
  version: 1,
  id: 'req-1',
  kind: 'personal_sign',
  chain: BASE_SEPOLIA,
  branch: 'binding',
  payload: { message: 'nonce-123' },
  response_uri: 'https://rp.example.com/sign/abc/response',
  expires_at: FAR_FUTURE,
  ...extra,
})

const typedData = {
  domain: { name: 'Login', chainId: 84532 },
  types: { Login: [{ name: 'nonce', type: 'string' }] },
  primaryType: 'Login',
  message: { nonce: 'n1' },
}

/** The first render in a cold worker loads many modules; wait longer than the default for it. */
const LOAD = { timeout: 5000 }

const answer = (body: string, status = 200) => ({ ok: status < 400, status, url: undefined, text: async () => body })

describe('SignRequest', () => {
  const started: TestServices[] = []
  const originalFetch = global.fetch
  afterEach(() => {
    started.splice(0).forEach((services) => services.balances.dispose())
    global.fetch = originalFetch
    navigation.goBack.mockClear()
  })

  const setup = async (
    request: Record<string, unknown> = base(),
    post: jest.Mock = jest.fn(async () => answer('', 204))
  ) => {
    const services = makeServices()
    started.push(services)
    const [adapter] = services.adapters
    const hooks = {
      checkSigningRequest: jest.fn(),
      signingAddress: jest.fn(async () => ADDRESS),
      signRequest: jest.fn(async () => ({ address: ADDRESS, signature: '0xsig' })),
    }
    Object.assign(adapter, hooks)
    global.fetch = jest.fn(async (_url: string, init?: { method?: string }) =>
      init?.method === 'POST' ? post() : answer(JSON.stringify(request))
    ) as unknown as typeof fetch
    renderWithServices(<SignRequest {...screenProps({ requestUrl: REQUEST_URL })} />, services)
    return { services, hooks, post }
  }

  const pressSignWithPin = async () => {
    await screen.findByTestId('CryptoSignConfirm')
    act(() => {
      fireEvent.press(screen.getByTestId('CryptoSignConfirm'))
    })
    await act(async () => fireEvent.press(screen.getByTestId('PinSuccess')))
  }

  it('shows who asks, the network, the address, the account and a nonce before anything is signed', async () => {
    const { hooks } = await setup()

    expect(await screen.findByText('https://rp.example.com', {}, LOAD)).toBeTruthy()
    expect(screen.getByText(ADDRESS)).toBeTruthy()
    expect(screen.getByText('Crypto.Sign.Branches.binding')).toBeTruthy()
    expect(screen.getByTestId('CryptoSignNonce').props.children).toBe('nonce-123')
    expect(hooks.signRequest).not.toHaveBeenCalled()
  })

  it('shows typed-data fields as text', async () => {
    await setup(base({ kind: 'eip712', payload: typedData }))

    expect(await screen.findByText('n1', {}, LOAD)).toBeTruthy()
    expect(screen.getAllByText('Login').length).toBeGreaterThan(0)
  })

  it('shows the statement and site of a sign-in message', async () => {
    const siwe = { domain: 'rp.example.com', uri: 'https://rp.example.com/login', chainId: 84532, nonce: 'abcdefgh' }
    await setup(base({ kind: 'siwe', payload: { ...siwe, statement: 'Sign in to RP' } }))

    expect(await screen.findByText('Sign in to RP')).toBeTruthy()
    expect(screen.getAllByText('rp.example.com').length).toBeGreaterThan(0)
  })

  it('signs after the PIN, posts the signature and records it', async () => {
    const post = jest.fn(async () => answer('', 204))
    const { services, hooks } = await setup(base(), post)

    await pressSignWithPin()

    await waitFor(() => expect(screen.getByTestId('CryptoSignDone')).toBeTruthy())
    expect(hooks.signRequest).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledTimes(1)
    const [saved] = await services.signatures.list()
    expect(saved).toMatchObject({ id: 'req-1', origin: 'https://rp.example.com', branch: 'binding', address: ADDRESS })
  })

  it('signs nothing and posts nothing when the PIN is cancelled', async () => {
    const post = jest.fn(async () => answer('', 204))
    const { hooks } = await setup(base(), post)

    await screen.findByTestId('CryptoSignConfirm')
    act(() => {
      fireEvent.press(screen.getByTestId('CryptoSignConfirm'))
    })
    await act(async () => fireEvent.press(screen.getByTestId('PinClose')))

    expect(hooks.signRequest).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
    expect(screen.getByTestId('CryptoSignConfirm')).toBeTruthy()
  })

  it('posts nothing and records nothing on Reject', async () => {
    const post = jest.fn(async () => answer('', 204))
    const { services } = await setup(base(), post)

    await screen.findByTestId('CryptoSignReject')
    fireEvent.press(screen.getByTestId('CryptoSignReject'))

    expect(navigation.goBack).toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
    expect(await services.signatures.list()).toEqual([])
  })

  it('retries a failed post without asking for the PIN or signing again', async () => {
    const post = jest.fn().mockResolvedValueOnce(answer('', 500)).mockResolvedValue(answer('', 204))
    const { hooks } = await setup(base(), post)

    await pressSignWithPin()
    await waitFor(() => expect(screen.getByText('Crypto.Sign.SendFailed')).toBeTruthy())
    await act(async () => fireEvent.press(screen.getByTestId('CryptoSignConfirm')))

    await waitFor(() => expect(screen.getByTestId('CryptoSignDone')).toBeTruthy())
    expect(hooks.signRequest).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledTimes(2)
  })

  it('shows a signing failure and records nothing', async () => {
    const { services, hooks } = await setup()
    hooks.signRequest.mockRejectedValueOnce(new Error('locked'))

    await pressSignWithPin()

    await waitFor(() => expect(screen.getByText('Crypto.Sign.SignFailed')).toBeTruthy())
    expect(await services.signatures.list()).toEqual([])
  })

  it('shows the reason and no Sign button when the adapter refuses the request', async () => {
    const services = makeServices()
    started.push(services)
    Object.assign(services.adapters[0], {
      checkSigningRequest: () => {
        throw new SigningRequestError('permit-refused', 'permit')
      },
      signingAddress: jest.fn(),
      signRequest: jest.fn(),
    })
    global.fetch = jest.fn(async () => answer(JSON.stringify(base()))) as unknown as typeof fetch
    renderWithServices(<SignRequest {...screenProps({ requestUrl: REQUEST_URL })} />, services)

    expect(await screen.findByText('Crypto.Sign.Refused.permit-refused')).toBeTruthy()
    expect(screen.queryByTestId('CryptoSignConfirm')).toBeNull()
  })

  it('reports an unexpected failure as such, not as a network problem', async () => {
    const services = makeServices()
    started.push(services)
    Object.assign(services.adapters[0], {
      checkSigningRequest: jest.fn(),
      signingAddress: jest.fn(async () => {
        throw new TypeError('boom')
      }),
      signRequest: jest.fn(),
    })
    global.fetch = jest.fn(async () => answer(JSON.stringify(base()))) as unknown as typeof fetch
    renderWithServices(<SignRequest {...screenProps({ requestUrl: REQUEST_URL })} />, services)

    expect(await screen.findByText('Crypto.Sign.Refused.unexpected', {}, LOAD)).toBeTruthy()
    expect(services.logger.warn).toHaveBeenCalledWith(expect.stringContaining('TypeError: boom'))
  })

  it('refuses an expired request and a response_uri of another origin', async () => {
    await setup(base({ expires_at: '2020-01-01T00:00:00Z' }))
    expect(await screen.findByText('Crypto.Sign.Refused.expired')).toBeTruthy()
  })

  it('refuses a response_uri of another origin', async () => {
    await setup(base({ response_uri: 'https://evil.example.com/r' }))
    expect(await screen.findByText('Crypto.Sign.Refused.origin-mismatch')).toBeTruthy()
  })

  it('refuses a chain this wallet does not have', async () => {
    await setup(base({ chain: 'eip155:1' }))
    expect(await screen.findByText('Crypto.Sign.Refused.unsupported')).toBeTruthy()
  })
})
