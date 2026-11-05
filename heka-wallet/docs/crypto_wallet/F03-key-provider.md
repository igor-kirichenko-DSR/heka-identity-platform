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

Where a line below and "Decisions" (end of this file) differ, "Decisions" wins; superseded lines say so.

### Wallet — `packages/crypto/core`

-   `src/keys/KeyProvider.ts`: interface from §2.3, plus `removeSeed(auth: AuthProof): Promise<void>`, `importRawKey`, `seedKind`, `lock`, `unlock`, `isLocked` (see `KeyProvider.ts`).
-   `src/keys/AskarSeedStore.ts` (storage per Spike C):
    -   seed record: value = mnemonic or raw key, raw Askar entry `crypto` / `seed`, tags `{ kind: 'mnemonic' | 'raw', version, createdAt }` (no `type` tag; see Decisions);
    -   address record: public addresses per branch and index, so reads never open the seed;
    -   storage injected: `AskarSeedStore` takes a raw-session runner the app builds from the main agent (`createAgentTransactionRunner`, `app/src/utils/askarSession.ts`), never from the DC API agent; `crypto/core` imports no agent or React code.
-   `src/keys/derivation.ts`: payment branch `m/44'/60'/0'/0/{i}`, binding branch `m/44'/60'/1'/0/{i}`; raw-key wallets have only index 0 and no binding branch (the UI hides what needs it).
-   `withAccount(purpose, index, fn)`: reads the seed, derives, calls `fn`, then drops every reference; refuses while the wallet is locked. No module-level cache of keys or mnemonics.
-   `AuthProof`: a value only the confirmation flow can produce (fresh PIN entry or biometry within the last N seconds), checked by `revealMnemonic` and `removeSeed`.
-   `lock()` / `unlock()` on the provider: `lock()` clears any in-flight state and rejects pending `withAccount` calls. The UI layer calls them; core does not know about React contexts.

### Wallet — `packages/crypto/evm`

-   `EvmAccount` takes the `LocalAccount` from `withAccount`; never stores it.

### Wallet — `packages/crypto/ui`

Moved to F04 (see Decisions); kept here for the original intent.

-   `CryptoProvider` subscribes to the app's lockout state (`AgentLockout` context) and calls `KeyProvider.lock()` / `unlock()`.
-   `useAuthProof` hook: wraps `ConfirmationInputModal` and `authenticateByBiometry` from `packages/shared` and returns an `AuthProof`.
-   Register, RevealPhrase and remove-wallet screens (F04) use it.

### Wallet — `app`

-   Done in F03: `createAgentTransactionRunner(agent)` (`app/src/utils/askarSession.ts`); `CryptoProvider` (F04) passes it to `AskarSeedStore`. It refuses while the store is closed (after lockout) instead of letting Credo reopen it.
-   Backup prompt (moved to F04's Done screen): after create or import, if `isWalletBackupEnabled` (`app/src/config.ts`) is true, show "back up now" that opens the existing backup flow (`BackupStack`, `useWalletBackupHelpers.backupWallet`). If false, the register flow's phrase verification is the backup; say so on the done screen.
-   Restore: `useWalletBackupHelpers.restoreWallet` already imports the whole Askar store; after restore, `AccountStore` reads the address record; no extra code expected — checked on a second device in F06 acceptance.
-   PIN change: Askar rekeys the store; no extra code expected — checked on a device in Spike C.

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
-   Integration: no Askar runtime for Node, so Jest runs on a fake session; write, lock, unlock and PIN change were checked on a device in Spike C; backup → restore moved to F15 acceptance.
-   Maestro (moved to F04 with the screens): create wallet → verify phrase → done; import mnemonic.

## Specs and docs

-   `specs/wallet/30-Features/Onboarding-and-Auth.md`: crypto seed under the same PIN, lockout behaviour.
-   `specs/wallet/30-Features/` backup page (or the existing backup section): the seed is part of the backup; prompt after creation.

## Acceptance criteria

-   One PIN unlocks credentials and payments; no second password anywhere.
-   After lock, no signature is possible until unlock.
-   A seed survives PIN change and backup → restore on a second device, and derives the same addresses (backup → restore checked in F15 acceptance).
-   The phrase is shown only after fresh authentication.

## Open questions

-   Binding branch per integration (payment account vs `m/44'/60'/1'`): recorded per demonstration in F14.

## Decisions

Agreed 2026-11-10 (DSRDSC-293):

-   Scope: F03 delivers the `crypto/core` part (`SeedKeyProvider`, `AskarSeedStore`, `MemorySeedStorage`, derivation, address record, `AuthProof` issuer, `lock()` / `unlock()`) and the app's `createAgentTransactionRunner` (`app/src/utils/askarSession.ts`). `CryptoProvider`'s lockout wiring, `useAuthProof` and the "back up now" prompt move to F04, where `packages/crypto/ui` is created. Backup → restore on a second device moves to F06 acceptance, the first build where the app writes a seed. The Maestro flows stay with the F04 screens.
-   Storage (Spike C): raw Askar entries in category `crypto`, not a Credo generic record. Entry `seed`: value = the normalised mnemonic or the `0x` private key, tags `{ kind: 'mnemonic' | 'raw', version: '1', createdAt }` (no `type` tag, the category says it). Entry `addresses`: JSON `{ payment: { "<index>": "0x…" }, binding: { … } }`. The app passes Credo's `withTransaction`, so the seed and its addresses are written and removed together; the runner refuses while the store is closed (after lockout), because Credo would otherwise reopen it with the PIN-derived key it still holds. Address writes are serialised in the provider and skipped when the stored seed is no longer the one the address was derived from. Lock / unlock and PIN change were checked on a device in Spike C; unit tests run on a fake session (no Askar runtime for Node).
-   Addresses: payment #0 (and binding #0 for a mnemonic) are written on create / import; `withAccount` adds an index it opens for the first time. `getAddress` returns the payment address for EVM chains and nothing for other kinds.
-   `AuthProof`: `SeedKeyProvider.createAuthProofIssuer()` works once; a proof is valid for 60 s (`AUTH_PROOF_MAX_AGE_MS`) and for one use. `crypto/ui`'s `useAuthProof` (F04) holds the issuer.
-   Public test phrases ("abandon … about", "test … junk") and their payment #0 keys are refused in every build.
-   Raw-key wallet: `revealMnemonic` refuses with `UnsupportedKeyError`; `seedKind()` lets F04 hide reveal and binding.
-   Derivation is async (`mnemonicToSeed`, one master seed per call), so PBKDF2 does not block the JS thread; the master key and seed bytes are wiped after use (best effort in JS).
-   The provider starts locked; `lock()` rejects pending `withAccount` calls. A signature already computed inside `fn` cannot be recalled, so a send whose transaction was already broadcast still completes on chain.
