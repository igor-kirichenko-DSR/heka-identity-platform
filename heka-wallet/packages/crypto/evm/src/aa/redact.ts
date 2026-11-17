// Bundler and RPC URLs carry the operator's API key in the query; errors quote the URL, and errors are logged.
const SECRET_PARAMETER = /([?&](?:api[-_]?key|key|token|secret)=)[^&\s"'\\]+/gi

/** The message with the value of any `apikey=`-style query parameter replaced. */
export const redactSecrets = (message: string): string => message.replace(SECRET_PARAMETER, '$1***')

/** An error's message, redacted; non-errors are stringified first. */
export const safeMessage = (error: unknown): string =>
  redactSecrets(error instanceof Error ? error.message : String(error))
