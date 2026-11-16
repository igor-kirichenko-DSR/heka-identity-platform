import { renderHook } from '@testing-library/react-native'

import { useInvitationHandlers } from '../../src/utils/useInvitationHandlers'

const PAYMENT_LINK = 'ethereum:0x1111111111111111111111111111111111111111@84532?value=5'
const SIGNING_URL = 'https://rp.example.com/sign/abc'
const SIGNING_LINK = `heka-sign://?request_uri=${encodeURIComponent(SIGNING_URL)}`
const OPENID_LINK = 'openid-credential-offer://?credential_offer_uri=https://issuer.example/offer'

const mockNavigate = jest.fn()
const mockParseInvitationUrl = jest.fn()
const mockPrefillFromEip681 = jest.fn()
const mockSetChain = jest.fn()
let mockCrypto: object | null

jest.mock('@bifold/core', () => ({
  Stacks: { BifoldStack: 'BifoldStack', TabStack: 'TabStack' },
  TOKENS: { UTIL_LOGGER: 'UTIL_LOGGER', CONFIG: 'CONFIG' },
  connectFromScanOrDeepLink: jest.fn(),
  useServices: () => [{}, { enableImplicitInvitations: false, enableReuseConnections: false }],
}))
jest.mock('@bifold/core/src/utils/parsers', () => ({
  parseInvitationUrl: (url: string) => mockParseInvitationUrl(url),
}))
jest.mock('@bifold/react-hooks', () => ({ useOptionalAgent: () => ({ agent: undefined }) }))
jest.mock('@react-navigation/core', () => {
  const navigation = { navigate: (...args: unknown[]) => mockNavigate(...args), getParent: jest.fn() }
  return { useNavigation: () => navigation }
})
jest.mock('@heka-wallet/crypto-ui', () => ({
  CryptoScreens: { Send: 'CryptoSend', SignRequest: 'CryptoSignRequest' },
  CryptoStacks: { Main: 'CryptoMain' },
  useOptionalCrypto: () => mockCrypto,
  prefillFromEip681: (...args: unknown[]) => mockPrefillFromEip681(...args),
}))

describe('useInvitationHandlers payment links', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCrypto = { accounts: { currentChainId: 'eip155:84532', setChain: mockSetChain }, registry: {} }
    mockPrefillFromEip681.mockReturnValue({ chainId: 'eip155:84532', prefill: { to: '0x1', amount: '5' } })
    mockParseInvitationUrl.mockResolvedValue({ success: false })
  })

  const handle = (url: string) => renderHook(() => useInvitationHandlers()).result.current.handleInvitationUrl(url)

  it('opens Send prefilled for an ethereum: link when the module is on', async () => {
    await handle(PAYMENT_LINK)

    expect(mockSetChain).toHaveBeenCalledWith('eip155:84532')
    expect(mockNavigate).toHaveBeenCalledWith('BifoldStack', {
      screen: 'TabStack',
      params: {
        screen: 'TabCryptoStack',
        params: {
          screen: 'CryptoMain',
          params: { screen: 'CryptoSend', params: { prefill: { to: '0x1', amount: '5' } }, initial: false },
        },
      },
    })
    expect(mockParseInvitationUrl).not.toHaveBeenCalled()
  })

  it('treats an ethereum: link as unrecognised when the module is off', async () => {
    mockCrypto = null

    await expect(handle(PAYMENT_LINK)).rejects.toThrow('Invitation message is not recognized')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('rejects a link for an unsupported chain without navigating', async () => {
    mockPrefillFromEip681.mockImplementation(() => {
      throw new Error('Payment request for an unsupported chain')
    })

    await expect(handle(PAYMENT_LINK)).rejects.toThrow('unsupported chain')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('keeps the OpenID path for other links when the module is on', async () => {
    mockParseInvitationUrl.mockResolvedValue({
      success: true,
      result: { type: 'openid-credential-offer', format: 'url', data: OPENID_LINK },
    })

    await handle(OPENID_LINK)

    expect(mockPrefillFromEip681).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith(
      'OpenIdStack',
      expect.objectContaining({ screen: 'OpenIdCredentialOffer' })
    )
  })

  it('opens SignRequest with the request URL of a heka-sign link when the module is on', async () => {
    await handle(SIGNING_LINK)

    expect(mockNavigate).toHaveBeenCalledWith('BifoldStack', {
      screen: 'TabStack',
      params: {
        screen: 'TabCryptoStack',
        params: {
          screen: 'CryptoMain',
          params: { screen: 'CryptoSignRequest', params: { requestUrl: SIGNING_URL }, initial: false },
        },
      },
    })
    expect(mockParseInvitationUrl).not.toHaveBeenCalled()
    expect(mockSetChain).not.toHaveBeenCalled()
  })

  it('treats a heka-sign link as unrecognised when the module is off', async () => {
    mockCrypto = null

    await expect(handle(SIGNING_LINK)).rejects.toThrow('Invitation message is not recognized')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('rejects a heka-sign link without a request URL and does not navigate', async () => {
    await expect(handle('heka-sign://?other=1')).rejects.toThrow('request_uri')
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
