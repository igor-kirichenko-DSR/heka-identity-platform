import type { CoreLogger } from '../../src'

export const makeLogger = (): jest.Mocked<CoreLogger> => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
})
