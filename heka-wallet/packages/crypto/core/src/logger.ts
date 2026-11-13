/** Injected by the app (its GlobalLogger context logger); core cannot import @heka-wallet/shared. */
export interface CoreLogger {
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  error(message: string, data?: Record<string, unknown>): void
}
