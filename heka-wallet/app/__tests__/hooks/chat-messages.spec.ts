import { DidCommConnectionRecord } from '@credo-ts/didcomm'
import { renderHook, waitFor } from '@testing-library/react-native'

import { useChatMessagesByConnection } from '../../src/hooks/chat-messages'

jest.mock('@bifold/core', () => {
  const store = [{ preferences: { alternateContactNames: {} } }]
  return {
    getConnectionName: (connection: { theirLabel?: string }) => connection?.theirLabel,
    Screens: {},
    Stacks: {},
    useStore: () => store,
  }
})

let mockBasicMessages: unknown[] = []

jest.mock('@bifold/core/src/utils/helpers', () => ({ getMessageEventRole: () => 'them' }))

jest.mock('@bifold/react-hooks', () => {
  const none: unknown[] = []
  return {
    useBasicMessagesByConnectionId: () => mockBasicMessages,
    useCredentialsByConnectionId: () => none,
    useProofsByConnectionId: () => none,
  }
})

jest.mock('@credo-ts/didcomm', () => ({
  DidCommCredentialState: {},
  DidCommProofState: {},
}))

jest.mock('@heka-wallet/shared', () => {
  const theme = { ChatTheme: { rightText: {}, rightTextHighlighted: {} }, ColorPalette: { brand: {} } }
  const logger = { error: jest.fn() }
  return {
    ColorPalette: { brand: {}, grayscale: {}, semantic: {} },
    GlobalLogger: { createContextLogger: () => logger },
    useHekaTheme: () => theme,
  }
})

jest.mock('@react-navigation/native', () => {
  const navigation = { navigate: jest.fn() }
  return { useNavigation: () => navigation }
})

jest.mock('react-i18next', () => {
  const translation = { t: (key: string) => key }
  return { useTranslation: () => translation }
})

jest.mock('../../src/components/chat/ChatEvent', () => ({
  ChatEvent: () => null,
  EventStates: {},
  EventTypes: {},
}))
jest.mock('../../src/credentials', () => ({ resolveOverlay: jest.fn() }))

const createConnection = (createdAt: Date) =>
  ({ id: 'connection-id', theirLabel: 'Issuer', createdAt }) as unknown as DidCommConnectionRecord

describe('useChatMessagesByConnection', () => {
  beforeEach(() => {
    mockBasicMessages = []
  })

  it('uses the current connection for the connected message', async () => {
    const first = createConnection(new Date('2026-01-01T00:00:00Z'))
    const updated = createConnection(new Date('2026-02-01T00:00:00Z'))

    const { result, rerender } = renderHook(
      ({ connection }: { connection: DidCommConnectionRecord }) => useChatMessagesByConnection(connection),
      { initialProps: { connection: first } }
    )
    await waitFor(() => expect(result.current).toHaveLength(1))

    rerender({ connection: updated })

    await waitFor(() => expect(result.current[0].createdAt).toEqual(updated.createdAt))
  })

  it('returns a basic message as text and link segments, an email address as mailto', async () => {
    const createdAt = new Date('2026-03-01T00:00:00Z')
    mockBasicMessages = [{ id: 'message-id', content: 'See https://heka.example/a or mail me@heka.example', createdAt }]

    const { result } = renderHook(() => useChatMessagesByConnection(createConnection(new Date('2026-01-01T00:00:00Z'))))
    await waitFor(() => expect(result.current).toHaveLength(2))

    expect(result.current[0].content).toEqual({
      kind: 'text',
      segments: [
        { text: 'See ' },
        { text: 'https://heka.example/a', link: 'https://heka.example/a' },
        { text: ' or mail ' },
        { text: 'me@heka.example', link: 'mailto:me@heka.example' },
        { text: '' },
      ],
    })
    expect(result.current[1].content).toEqual({ kind: 'connected', label: 'Issuer' })
  })
})
