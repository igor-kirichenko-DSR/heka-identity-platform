# F03 — Key provider: seed, derivation, backup, reveal, import, remove

-   **Phase:** 1 (provider), 2 (screens that use it)
-   **Depends on:** F00 Spike C
-   **Gate:** Spike C (Askar record; fallback `expo-secure-store` keystore)
-   **Design:** §2.5

## Goal

One BIP-39 seed per wallet, stored encrypted in the identity wallet's Askar store, unlocked by the same PIN, with keys that exist only for the duration of a signature.

## Scope

-   In: `KeyProvider`, `AskarSeedStore`, address cache, payment and binding derivation branches, reveal, import (mnemonic, raw key), remove, the "back up now" prompt.
-   Out: hardware keys, multiple seeds, a second password.

## Components

### Wallet — `packages/crypto/core`

-   `src/keys/KeyProvider.ts`: interface from §2.3, plus `removeSeed(auth: AuthProof): Promise<void>`.
-   `src/keys/AskarSeedStore.ts` (storage per Spike C):
    -   seed record: value = mnemonic or raw key, tags `{ type: 'crypto-seed', kind: 'mnemonic' | 'raw', version, createdAt }`;
    -   address record: public addresses per branch and index, so reads never open the seed;
    -   storage injected by the app as a small `SeedStorage` interface backed by the main agent (`useHekaAgent`), never by the DC API agent; `crypto/core` imports no agent or React code.
-   `src/keys/derivation.ts`: payment branch `m/44'/60'/0'/0/{i}`, binding branch `m/44'/60'/1'/0/{i}`; raw-key wallets have only index 0 and no binding branch (the UI hides what needs it).
-   `withAccount(purpose, index, fn)`: reads the seed, derives, calls `fn`, then drops every reference; refuses while the wallet is locked. No module-level cache of keys or mnemonics.
-   `AuthProof`: a value only the confirmation flow can produce (fresh PIN entry or biometry within the last N seconds), checked by `revealMnemonic` and `removeSeed`.
-   `lock()` / `unlock()` on the provider: `lock()` clears any in-flight state and rejects pending `withAccount` calls. The UI layer calls them; core does not know about React contexts.

### Wallet — `packages/crypto/evm`

-   `EvmAccount` takes the `LocalAccount` from `withAccount`; never stores it.

### Wallet — `packages/crypto/ui`

-   `CryptoProvider` subscribes to the app's lockout state (`AgentLockout` context) and calls `KeyProvider.lock()` / `unlock()`.
-   `useAuthProof` hook: wraps `ConfirmationInputModal` and `authenticateByBiometry` from `packages/shared` and returns an `AuthProof`.
-   Register, RevealPhrase and remove-wallet screens (F04) use it.

### Wallet — `app`

-   `SeedStorage` implementation over the main agent, passed to `CryptoProvider`.
-   Backup prompt: after create or import, if `isWalletBackupEnabled` (`app/src/config.ts`) is true, show "back up now" that opens the existing backup flow (`BackupStack`, `useWalletBackupHelpers.backupWallet`). If false, the register flow's phrase verification is the backup; say so on the done screen.
-   Restore: `useWalletBackupHelpers.restoreWallet` already imports the whole Askar store; after restore, `AccountStore` reads the address record; no extra code expected — covered by a test.
-   PIN change: Askar rekeys the store; no extra code expected — covered by a test.

### Wallet — `packages/shared`

-   No change; `ConfirmationInputModal` and `authenticateByBiometry` (`packages/shared/src/utils/biometry.ts`) are reused by `crypto/ui`.

### Identity Service

No change.

### Demo

No change.

## Tests

-   Unit: derivation vectors (BIP-39 / BIP-32 test vectors; the known address for the "test test … junk" mnemonic at both branches); raw-key import; invalid mnemonic and checksum rejection.
-   Unit: no key material after `withAccount` returns or throws (spy on the account factory; assert the provider holds no reference); refusal while locked.
-   Unit: `revealMnemonic` and `removeSeed` reject a stale or missing `AuthProof`.
-   Integration (Jest with the Askar test store if available, otherwise Spike C manual check recorded): write, lock, unlock, read; PIN change; backup → restore.
-   Maestro: create wallet → verify phrase → done; import mnemonic.

## Specs and docs

-   `specs/wallet/30-Features/Onboarding-and-Auth.md`: crypto seed under the same PIN, lockout behaviour.
-   `specs/wallet/30-Features/` backup page (or the existing backup section): the seed is part of the backup; prompt after creation.

## Acceptance criteria

-   One PIN unlocks credentials and payments; no second password anywhere.
-   After lock, no signature is possible until unlock.
-   A seed survives PIN change and backup → restore on a second device, and derives the same addresses.
-   The phrase is shown only after fresh authentication.

## Open questions

-   Binding branch per integration (payment account vs `m/44'/60'/1'`): recorded per demonstration in F14.
