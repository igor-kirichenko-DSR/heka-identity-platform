import type { ChainId } from '@heka-wallet/crypto-core'

/** Used when `CRYPTO_DEFAULT_CHAIN` is empty or names a chain this build does not register. */
export const FALLBACK_CRYPTO_CHAIN: ChainId = 'eip155:84532'

/** Env name suffix → chain. A chain gets its `CRYPTO_RPC_URL_<suffix>` / `CRYPTO_BUNDLER_URL_<suffix>` here (F08 adds its bundler URLs). */
const REGISTERED_CHAINS: Record<string, ChainId> = {
  BASE_SEPOLIA: 'eip155:84532',
  HEDERA_TESTNET: 'eip155:296',
}

export interface CryptoChainOverrides {
  rpcUrl?: string
  bundlerUrl?: string
}

export interface CryptoConfig {
  defaultChain: ChainId
  overrides: Partial<Record<ChainId, CryptoChainOverrides>>
}

export type CryptoEnv = Record<string, string | undefined>

type Warn = (message: string) => void

/** An unsafe override outside development: the app refuses to start rather than send payment traffic in clear text. */
export class CryptoConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CryptoConfigError'
  }
}

const parseOverride = (name: string, value: string | undefined, isDev: boolean, warn: Warn): string | undefined => {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  let protocol: string | undefined
  try {
    protocol = new URL(trimmed).protocol
  } catch {
    // Parsing failed: handled below like any other unusable value.
  }
  const allowed = protocol === 'https:' || (isDev && protocol === 'http:')
  if (allowed) return trimmed
  if (!isDev) throw new CryptoConfigError(`${name} must be an https:// URL`)
  warn(`${name} ignored: not a valid URL`)
  return undefined
}

/** Reads the payment module's settings from env values. Pure: `config.ts` passes `Config` and `__DEV__`. */
export const buildCryptoConfig = (env: CryptoEnv, isDev: boolean, warn: Warn): CryptoConfig => {
  const requested = env.CRYPTO_DEFAULT_CHAIN?.trim()
  const registered = Object.values(REGISTERED_CHAINS)
  let defaultChain: ChainId = FALLBACK_CRYPTO_CHAIN
  if (requested) {
    const match = registered.find((chainId) => chainId === requested)
    if (match) defaultChain = match
    else warn(`CRYPTO_DEFAULT_CHAIN ${requested} is not a registered chain; using ${FALLBACK_CRYPTO_CHAIN}`)
  }

  const overrides: CryptoConfig['overrides'] = {}
  for (const [suffix, chainId] of Object.entries(REGISTERED_CHAINS)) {
    const rpcUrl = parseOverride(`CRYPTO_RPC_URL_${suffix}`, env[`CRYPTO_RPC_URL_${suffix}`], isDev, warn)
    const bundlerUrl = parseOverride(`CRYPTO_BUNDLER_URL_${suffix}`, env[`CRYPTO_BUNDLER_URL_${suffix}`], isDev, warn)
    if (rpcUrl || bundlerUrl) overrides[chainId] = { rpcUrl, bundlerUrl }
  }
  return { defaultChain, overrides }
}
