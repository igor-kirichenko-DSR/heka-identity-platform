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
