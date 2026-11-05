# F15 — Hardening, documentation and rollout

-   **Phase:** 4
-   **Depends on:** MVP done (F00–F08); F12–F14 for their own review items
-   **Gate:** none
-   **Design:** §3 Phase 4, §4

## Goal

Make the module releasable: a security review against the threat model, specs and roadmap in line with the code, and the rollout decisions taken.

## Components

### Wallet — all crypto packages and `app`

Security review (report in the AI package's runtime artifacts; findings become tickets):

-   **Keys:** lifetime inside `withAccount`; no key or mnemonic in logs, crash reports, MobX state, navigation params or the clipboard; lockout clears state.
-   **Confirm before sign:** every signature (transaction, user operation, permit, authorization, typed data, SIWE, nonce) follows a screen the holder approved with fresh auth, except the paymaster permit and 7702 authorization signed as part of an approved send.
-   **Chain-id pinning** in every signed payload; registry chain ids cannot be overridden by config.
-   **Units:** no floating point in amount paths; Hedera 10¹⁰ conversion only at the relay edge.
-   **7702:** pinned implementation address; foreign delegation detection; revocation (authorize to the zero address) tested; decide whether revocation is a user action in Settings.
-   **Backup:** the seed is inside the passkey backup — review the zip encryption used by `react-native-zip-archive`, the iOS 32-character password truncation (`useWalletBackupHelpers.ts`), and what the backup service at `WALLET_PROVIDER_URL` can see (the zip; the store key is inside the encrypted zip's metadata). File separate issues if weak.
-   **Reveal screen:** screenshot and recording protection on Android and iOS; auto-hide on background.
-   **Signing requests and `transaction_data`:** origin checks, expiry, permit-shaped typed data refused, unknown transaction-data types refused.
-   **Dependencies:** exact versions; `yarn npm audit`; Dependabot delta; SBOM (`bom.cdx.json`) refreshed.
-   OWASP MASVS v2 mapping for the storage, crypto and auth areas.

### Identity Service

-   Review of F12 (transaction-data validation, result exposure) and F13 (status list signing, public endpoint caching, index allocation under concurrency).

### Demo

-   Check that no demo commits keys and that demo endpoints refuse `http` outside local development.

### Specs and docs (AI package and repo)

-   `specs/wallet/`: Code-Map, Architecture (workspaces: `packages/crypto/*` — `core`, `ui`, `evm`), Modules pages, Features pages (payments, signing requests, presentations with transaction data), Platform (Config-and-Flags, Hedera EVM), Testing (new jest projects, `CRYPTO_IT`, Maestro flows), Change-Impact-Map. Run the `update-specs` skill at the end.
-   `specs/identity-service/`: verification sessions (F12), revocation and status lists (F13).
-   `specs/demo/`: F14 pages.
-   `ROADMAP.md`: replace "HBAR wallet integration for Heka Wallet" with the chain-agnostic payment module (stablecoin first, Base Sepolia + Hedera testnet).
-   `heka-wallet/docs/Idea and high-level design.md`: risks table updated with the spike numbers and review results.

### Rollout

-   Testnets only; mainnet twins stay `enabled: false`.
-   Decide and record: chains for any non-testnet build; RPC and bundler vendors; whether an operator-run proxy is needed (and who runs it); who pays for keyed vendors; a commercial Hedera relay instead of Hashio.
-   Default value of `ENABLE_CRYPTO_MODULE` per build flavour (off for public builds until the review is closed).

## Tests

-   All suites green: `yarn typecheck && yarn lint && yarn test` (wallet), Identity Service verify + unit + e2e, Maestro flows.
-   Coverage report for `heka-wallet` at or above 60 % of lines, new packages included.

## Acceptance criteria

-   The security review has no open high or critical finding.
-   A seed survives backup → restore on a second device and derives the same addresses (moved from F03 to F06 on 2026-11-10, then to F15 on 2026-11-13).
-   Specs pass the `update-specs` check for the touched codebases.
-   Rollout decisions are written in the design doc.
