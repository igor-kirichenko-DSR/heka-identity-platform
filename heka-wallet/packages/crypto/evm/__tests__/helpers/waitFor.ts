const DEFAULT_INTERVAL_MS = 1_000

/** Polls until check returns a value, or fails after timeoutMs; never a fixed sleep. */
export const waitFor = async <T>(
  check: () => Promise<T | undefined>,
  timeoutMs: number,
  intervalMs = DEFAULT_INTERVAL_MS
): Promise<T> => {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await check()
    if (value !== undefined) return value
    if (Date.now() > deadline) throw new Error(`Condition not met within ${timeoutMs} ms`)
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
