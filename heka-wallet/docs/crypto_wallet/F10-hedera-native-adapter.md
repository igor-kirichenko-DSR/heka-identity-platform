# F10 — Hedera-native adapter (deferred)

-   **Phase:** 5.2 — only when HBAR returns to focus or the relay proves unreliable
-   **Depends on:** F01, F03, F05
-   **Gate:** a native-only need (staking, association management for legacy accounts, memo semantics) or relay availability problems
-   **Design:** §2.4 "Hedera-native adapter"

## Goal

A `ChainAdapter` with `kind: 'hedera-native'` that talks to Hedera through the Hiero SDK (gRPC) and Mirror Node, for the same ECDSA account the MVP uses.

## Components

### Wallet — new package `packages/crypto/hedera`

-   SDK: the `@hashgraph/sdk` copy the app already ships through `@credo-ts/hedera` (no second SDK); move to `@hiero-ledger/sdk` when Credo does.
-   Keys: `Mnemonic.toStandardECDSAsecp256k1PrivateKeyCustomDerivationPath` at `m/44'/60'/0'/0/i`, inside `KeyProvider.withAccount` (F03 gains a raw-key accessor for this purpose, still scoped).
-   Writes: `TransferTransaction` for HBAR and HTS with `maxTransactionFee`; `TokenAssociateTransaction`; receipts by polling.
-   Reads: Mirror Node (`/api/v1/accounts/{id}`, `/api/v1/transactions`, `/api/v1/network/exchangerate`), shared with F05's `MirrorNodeClient` (move it to a shared place first).
-   Registry entry `hedera:testnet`, `enabled: false` until chosen over `eip155:296`.

### Wallet — `packages/crypto/core`

-   `ChainId` already allows `hedera:testnet`; `ChainDescriptor.kind: 'hedera-native'` uses `mirrorNodeUrl` instead of `rpcUrl`.

### Wallet — `app`

-   Registration in `CryptoProvider`; nothing else.

### Identity Service

No change.

### Demo

No change.

## Tests

-   Unit: transaction building and fee caps; key derivation gives the same `0.0.x` as F05 for the same seed.
-   Integration behind `CRYPTO_IT=1`: HBAR and USDC transfers on testnet.

## Acceptance criteria

-   The holder sees the same `0.0.x` account and balances through either adapter.
-   No second Hedera SDK copy in the bundle (check with `yarn why`).
