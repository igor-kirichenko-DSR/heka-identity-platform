# F05 — Hedera testnet through the EVM adapter

-   **Phase:** 1 (adapter), 2 (UI parts in F04)
-   **Depends on:** F02
-   **Gate:** Spike B (if it fails, Hedera leaves the MVP)
-   **Design:** §2.4 "Hedera through the same adapter", §2.6 Hedera variants

## Goal

HBAR and USDC on Hedera testnet with the same `EvmAdapter`, the Hedera-specific behaviour isolated in `crypto/evm/hedera/`.

## Scope

-   In: registry entry `eip155:296`; activation state; HTS association through the facade; tinybar ↔ weibar conversion; Mirror Node balances, history and status cross-check.
-   Out: Hiero SDK and gRPC (F10); gas in USDC on Hedera (Phase 5.4).

## Components

### Wallet — `packages/crypto/evm`

-   `src/chains/hederaTestnet.ts`: chain 296; HBAR native with `decimals: 8`; USDC `0.0.429274` at its long-zero EVM address (from Spike B), `kind: 'hts'`, `decimals: 6`; `historySource: 'mirror-node'`; `mirrorNodeUrl` (testnet); Hashio RPC as dev default with the `CRYPTO_RPC_URL_<CHAIN>` override; explorer HashScan; no `paymaster`.
-   `src/hedera/units.ts`: tinybar ↔ weibar (× / ÷ 10¹⁰, round down on read); applied only at the relay edge.
-   `src/hedera/MirrorNodeClient.ts`: `GET /api/v1/accounts/{evmAddress|id}`, `/api/v1/accounts/{id}/tokens`, `/api/v1/transactions?account.id=…` (paged by `links.next`), `/api/v1/contracts/results/{ethereumTxHash}`; timeouts and backoff; maps to `TxRecord`.
-   `src/hedera/HtsFacade.ts`: `isAssociated()` and `associate()` on the token address (HIP-719); `associate()` paid in HBAR.
-   `EvmAdapter` hooks for `kind 'evm'` chains with `historySource: 'mirror-node'`:
    -   `getBalances`: Mirror Node (tinybar and token balances exact);
    -   `getHistory`: Mirror Node;
    -   `getStatus`: relay receipt, then Mirror Node contract result; `success` only when both agree; `failed` if either reports failure; `pending` while Mirror Node lags (bounded by `pendingTimeoutMs`);
    -   `activationState`: `pending` until Mirror Node returns the account; `active` with `0.0.x`;
    -   `isAssetEnabled` / `enableAsset`: facade calls; auto-created accounts report enabled (HIP-904).
-   Fee quote: `eth_gasPrice` in weibar → shown in HBAR; gas limits from Spike B measurements per call type.

### Wallet — `packages/crypto/core`

-   `AccountStore` keeps the Hedera `0.0.x` id once known.
-   Optional interface members (`activationState`, `isAssetEnabled`, `enableAsset`) already in F01.

### Wallet — `packages/crypto/ui`

-   Banner and "Enable USDC" exist since F04; they show once the adapter has `activationState` / `isAssetEnabled`.
-   Receive: `0.0.x` next to `0x` once active. Needs an account-id read in the adapter interface (`crypto-core`); left to F05 by F04 "Decisions".

### Wallet — `app`

No change beyond F06 (registration of the entry).

### Identity Service

No change. `did:hedera` issuer DIDs and the Hedera DID registry are unaffected.

### Demo

No change.

## Tests

-   Unit: unit conversion edge cases (1 tinybar, max values, rounding down); Mirror Node response mapping (recorded fixtures for HBAR transfer, HTS transfer, failed transaction, account not found); status reconciliation matrix (relay ok / Mirror Node missing / Mirror Node failed).
-   Integration behind `CRYPTO_IT=1`: send 1 HBAR between two funded testnet accounts; USDC transfer; `associate()` on a non-associated account.
-   Maestro: Receive screen shows the activation banner for a fresh account (no network funding needed).

## Specs and docs

-   `specs/wallet/50-Platform/`: Hedera EVM page (relay, Mirror Node, units, activation) next to the existing Hedera / DID notes.

## Acceptance criteria

-   A fresh account receives HBAR, becomes active, shows `0.0.x`, sends HBAR (first send completes the hollow account), receives and sends USDC.
-   An imported pre-existing account without association sees "Enable USDC", associates, then receives USDC.
-   No transfer is marked final unless Mirror Node has the record.

## Open questions

-   Commercial relay for anything beyond dev / test: decided in F15 (rollout).
