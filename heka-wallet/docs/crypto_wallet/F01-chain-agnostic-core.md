# F01 — Chain-agnostic core

-   **Phase:** 1
-   **Depends on:** F00 cleanup
-   **Gate:** none
-   **Design:** §2.2, §2.3

## Goal

A chain-agnostic package that every adapter and every screen builds on: CAIP-based types, the adapter registry, bigint-safe units, MobX stores and a persisted local ledger.

## Scope

-   In: types, `ChainAdapter` and `KeyProvider` interfaces, `AdapterRegistry`, units and URI helpers, `AccountStore`, `BalanceStore`, `TransactionStore`, `LocalLedger`.
-   Out: any chain-specific code (F02, F05, F08, in `packages/crypto/evm`); screens, components and React context (F04, F06, in `packages/crypto/ui`); the key store implementation (F03).

## Components

### Wallet — `packages/crypto/core` (new)

Scaffold:

-   Folder `heka-wallet/packages/crypto/` holds all payment packages (`core`, `ui`, `evm`; later `hedera`, `walletconnect`).
-   Root `package.json` → `workspaces.packages`: add `packages/crypto/*`. The existing `packages/*` glob also matches the `packages/crypto` folder itself, which has no `package.json`; confirm `yarn install` accepts that, otherwise list `packages/shared` explicitly instead of `packages/*`.
-   `package.json`: name `@heka-wallet/crypto-core`, `private: true`, `main: ./src/index.ts` (same shape as `packages/shared`); exact dependency versions; no React or React Native dependency.
-   Root `jest.config.js`: add a project `@heka-wallet/crypto-core` with `getTestRegexForPath('packages/crypto/core')`; a Node test environment is enough.
-   ESLint and tsconfig pick the package up through the root config; check `yarn lint` and `yarn typecheck` cover it. An ESLint `no-restricted-imports` rule in `packages/crypto/core` forbids `react`, `react-native`, `@bifold/*` and `@heka-wallet/crypto-evm`.
-   Metro: confirm the app resolves workspace packages two levels deep (`app/metro.config.js` `watchFolders`).

Code:

-   `src/types/`: `ChainId`, `AssetId`, `AssetDescriptor`, `ChainDescriptor`, `Account`, `TransferRequest`, `FeeMode`, `FeeQuote`, `TxStatus`, `TxRecord` as in §2.3. `TxRecord` carries `chainId`, `txId`, `explorerHash` (differs from `txId` for user operations), `direction`, `asset`, `amount`, `counterparty`, `fee`, `status`, `createdAt`, `source: 'local' | 'chain'`.
-   `src/adapter/`: `ChainAdapter`, `AdapterRegistry` (`register`, `get(chainId)`, `list()`, rejects a duplicate chain id and any chain whose `enabled` is false).
-   `src/utils/units.ts`: `parseUnits(decimalString, decimals): bigint` and `formatUnits(bigint, decimals): string`; rejects more fraction digits than `decimals`, negative values and exponents. No `number` anywhere in amount paths.
-   `src/utils/eip681.ts`: EIP-681 build and parse (`ethereum:<token>@<chainId>/transfer?address=<to>&uint256=<amount>` and the native form); a parsed amount must fit in a uint256. `src/utils/caip.ts`: CAIP-2 and CAIP-10 build and parse.
-   `src/stores/`:
    -   `AccountStore`: current chain, account index 0, cached public addresses per chain (read from F03's address record, never derives keys itself).
    -   `BalanceStore`: polls `getBalances` with exponential backoff (start 10 s, cap 2 min, reset on app foreground and on pull-to-refresh); stops polling while the wallet is locked.
    -   `TransactionStore`: `submit(req)` → `adapter.transfer` → pending entry; polls `getStatus` until final or a per-chain timeout (`unknown`), taking the explorer hash and charged fee a final `StatusResult` reports; a final status in chain history also settles a `pending` or `unknown` send; merges `getHistory` pages with the ledger and de-duplicates by `chainId + txId`; allows one pending send per account and chain.
-   `src/ledger/LocalLedger.ts`: persists the wallet's own sends (pending and final) so they survive a restart. Storage behind a small `LedgerStorage` interface; `AskarLedgerStorage` writes raw Askar session entries (`category: 'crypto-ledger'`, name `<chainId>|<txId>`, tags `{ chainId, status }`, as Spike C chose for the seed) through a `withSession` function the app passes in (F06). On start, pending entries resume status polling.

### Wallet — `packages/crypto/evm`

No change (consumes the interfaces).

### Wallet — `packages/crypto/ui`

No change (created in F04).

### Wallet — `app`

No change in this sub-feature.

### Identity Service

No change.

### Demo

No change.

## Tests

-   Unit tests for `units` (round trips, 6 / 8 / 18 decimals, rejections), `eip681` (EIP-681 examples from the EIP, uint256 bound) and `caip` (CAIP-10), `AdapterRegistry`.
-   Store tests with a fake adapter and fake timers: backoff schedule, stop on lock, pending → success / failed / unknown, de-duplication of ledger and chain entries, one-pending-send rule.
-   `LocalLedger` with an in-memory storage fake: write, read after "restart", resume polling.
-   Recorded RPC fixtures (JSON files) for history merge cases.

## Specs and docs

-   `specs/wallet/20-Modules/`: new page for `crypto/core` (stores, ledger, registry).
-   `specs/wallet/00-How-To-Use/Code-Map.md`: the new package.

## Acceptance criteria

-   `yarn typecheck && yarn lint && yarn test` pass at `heka-wallet/` with the new jest project.
-   `packages/crypto/core` has no React, React Native or Bifold import (lint rule).
-   No floating-point arithmetic on amounts (lint rule or review check).
-   A pending send written before an app kill is shown and resolved after restart.

## Decisions

-   Layout `packages/crypto/{core,ui,evm}` (agreed): screens live in `crypto/ui`, so `crypto/core` stays pure TypeScript and testable without React Native mocks.
