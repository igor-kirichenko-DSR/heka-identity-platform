# F02 — EVM adapter (plain EOA path)

-   **Phase:** 1
-   **Depends on:** F01, F03 (`KeyProvider`)
-   **Gate:** Spike A (viem in RN; fallback ethers v6)
-   **Design:** §2.4 "EVM adapter", §2.6 Send / Receive

## Goal

One `ChainAdapter` implementation for EVM chains, on viem, that covers balances, fee quotes, native and ERC-20 transfers, status and logs-based history. Base Sepolia is the first registry entry.

## Scope

-   In: `EvmAdapter`, `EvmAccount`, the Base Sepolia registry entry (and Arbitrum Sepolia if Spike D falls back), disabled mainnet twins.
-   Out: user operations and the paymaster (F08); Hedera quirks (F05); ENS beyond a stub (Base Sepolia has no ENS).

## Components

### Wallet — `packages/crypto/evm` (new)

Scaffold as in F01 (`@heka-wallet/crypto-evm`, jest project, exact versions; `viem` pinned to the version Spike A validated).

-   `src/EvmAccount.ts`: builds a viem `LocalAccount` inside `KeyProvider.withAccount`; every signature passes the chain id explicitly (EIP-155 pinned).
-   `src/EvmAdapter.ts`:
    -   `deriveAccount`: address from F03's cached address record; derivation only on cache miss.
    -   `validateAddress`: EIP-55 checksum; an all-lowercase address is accepted with a warning; zero address and the token contract itself are rejected.
    -   `getBalances`: `getBalance` for native, `balanceOf` (multicall where available) for ERC-20.
    -   `estimateFee` (native mode): `estimateFeesPerGas()`, `estimateGas` × 1.2, capped by a per-chain gas ceiling; `FeeQuote.display` in the native asset. Returns a warning when the native balance cannot cover the fee.
    -   `transfer`: native `sendTransaction` or ERC-20 `writeContract(transfer)`; nonce from `getTransactionCount(address, 'pending')`; returns `{ txId: hash }` right after submission.
    -   `getStatus`: `getTransactionReceipt`; `success` / `failed` by receipt status; `pending` while missing.
    -   `getHistory`: `getLogs` for `Transfer` events with `from` = holder and `to` = holder, over `historyWindowBlocks` (per-chain config, from Spike A), paged backwards by cursor; no native inbound history.
-   `src/chains/baseSepolia.ts`: chain 84532, ETH native, USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (verify against Circle's list at implementation time), explorer `sepolia.basescan.org`, `historySource: 'rpc-logs'`, `historyWindowBlocks`, `pendingTimeoutMs`.
-   `src/chains/mainnet/*.ts`: twins with `enabled: false`.

### Wallet — `packages/crypto/core`

-   No new code; any interface gap found here is fixed in F01's types in the same change.

### Wallet — `app`

No change (wiring is F06).

### Identity Service

No change.

### Demo

No change.

## Tests

-   Unit tests with a mocked viem transport (recorded JSON-RPC responses): fee quote math and ceiling, address validation cases, ERC-20 vs native call shape, chain id present in every signed payload, history paging and window bounds, receipt → status mapping.
-   Integration test behind `CRYPTO_IT=1` (skipped by default): funded Base Sepolia account from a local untracked env file; send 0.01 USDC to itself, wait for receipt, see it in `getHistory`.

## Specs and docs

-   `specs/wallet/20-Modules/`: page for `crypto/evm`.
-   Registry parameters table (chain id, assets, explorer, window, timeout) in the same page.

## Acceptance criteria

-   On Base Sepolia from the app's JS runtime: balances, ETH send, USDC send, status to final, incoming USDC shown in history.
-   A signed transaction for chain A is never accepted by chain B (unit test on the serialized payload).

## Open questions

-   Multicall availability on the Hedera relay (F05): `getBalances` already falls back to one call per asset when the entry has no `multicall3` (F05 reads balances from Mirror Node anyway). Base Sepolia has Multicall3 at `0xcA11bde05977b3631167028862bE2a173976CA11`.

## Decisions

Agreed 2026-11-10 (DSRDSC-293):

-   Acceptance: F02 is accepted on the unit tests and the integration test against Base Sepolia (`CRYPTO_IT=1`, developer-run). The in-app check (balances, sends, status, history from the app's JS runtime) moves to F06, which wires the adapter.
-   EVM-only parameters (`gasLimitCeiling`, `logsMaxRange`, `multicall3`) live in `EvmChainConfig` in `crypto/evm`, not in core's `ChainDescriptor`. The viem chain is built with `defineChain` from the entry; `viem/chains` is not imported (bundle size, spike A).
-   Gas ceiling: a gas limit above it is refused, not clamped. Base Sepolia: 150 000.
-   Fee warning: core `FeeQuote.warnings?: FeeWarning[]`, code `'insufficient-native-balance'`; F04 translates it.
-   History: `historyWindowBlocks` 10 000 back from the head; `logsMaxRange` 200 per `getLogs` call (public RPC cap); a page stops at the first chunk with transfers or at the window floor; the cursor carries the floor.
-   `pendingTimeoutMs` 120 000 on Base Sepolia.
-   Mainnet twins: Base mainnet only (`enabled: false`); no Arbitrum Sepolia entry, since spike D was a go on Base Sepolia. Hedera entries are F05.
-   Signing: the adapter signs and calls `eth_sendRawTransaction` itself instead of `walletClient.sendTransaction` / `writeContract`, so the chain id in the payload is checked and the key is opened only for the signature. `transfer` also checks the RPC's `eth_chainId` before signing.
-   L1 data fee (added 2026-11-11, found on a device: Max ETH failed by 170 wei): Base is an OP-Stack chain and the node requires `balance >= value + gas × price + L1 fee`. A chain entry with `l1FeeOracle` (Base, Base Sepolia) adds 1.2 × the oracle's `getL1Fee` of the unsigned transaction to the quote, the fee cap and the funds warning. If the oracle cannot be read, the quote fails. F08 must count the L1 fee too.
-   Integration test key: `CRYPTO_IT_PRIVATE_KEY` in `packages/crypto/evm/.env.it` (gitignored).
