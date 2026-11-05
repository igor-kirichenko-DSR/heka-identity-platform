export class CryptoCoreError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class UnitsError extends CryptoCoreError {}

export class UriError extends CryptoCoreError {}

export class RegistryError extends CryptoCoreError {}

export class AccountError extends CryptoCoreError {}

export class PendingSendError extends CryptoCoreError {}

/** A store method was called before the store's init() finished. */
export class NotReadyError extends CryptoCoreError {}

export class LedgerError extends CryptoCoreError {}

/** Base for every key provider failure; never carries key material in its message. */
export class KeyError extends CryptoCoreError {}

/** The wallet is locked; keys open only after unlock. */
export class KeyLockedError extends KeyError {}

export class NoSeedError extends KeyError {}

/** One seed per wallet: create or import while a seed exists. */
export class SeedExistsError extends KeyError {}

/** A mnemonic or raw key that is malformed, fails its checksum or is a public test value. */
export class InvalidSeedError extends KeyError {}

/** The operation needs what this seed has not: a phrase, a binding branch or another index of a raw key. */
export class UnsupportedKeyError extends KeyError {}

export class AuthProofError extends KeyError {}

/** A seed or address entry in the store is malformed. */
export class KeyStorageError extends KeyError {}
