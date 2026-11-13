import { existsSync } from 'fs'
import { join } from 'path'

/** Funded testnet keys for the CRYPTO_IT=1 integration tests; one gitignored file for all of them. */
export const ENV_FILE = join(__dirname, '..', '..', '..', '..', '..', '.env.crypto-test-keys')

/** Loads the file into process.env when it exists; variables already set in the environment win. */
export const loadTestKeysEnv = (): void => {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE)
}
