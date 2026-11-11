import { renderHook } from '@testing-library/react-native'

import { useInvitationHandlers } from '../../src/utils/useInvitationHandlers'

const PAYMENT_LINK = 'ethereum:0x1111111111111111111111111111111111111111@84532?value=5'
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
  CryptoScreens: { Send: 'CryptoSend' },
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
})
