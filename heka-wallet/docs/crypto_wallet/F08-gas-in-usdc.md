# F08 — Gas paid in USDC (EIP-7702 + Circle Paymaster v0.8)

-   **Phase:** 1 (adapter), 2 (fee-mode UI in F04)
-   **Depends on:** F02, F03
-   **Gate:** Spike D (fails → fees stay native; only Arbitrum Sepolia works → that chain replaces Base Sepolia)
-   **Design:** §2.4 "Gas paid in USDC", §2.6 third diagram

## Goal

A holder with USDC and no ETH can send USDC on a chain with Circle Paymaster, paying the fee in USDC, from the same address.

## Scope

-   In: 7702 upgrade on first use, bundler client, paymaster data from an EIP-2612 permit, USDC fee quote, status by user-operation receipt, charged-fee read-back, automatic fallback to native mode.
-   Out: other paymasters; sponsorship (operator pays); Hedera (no 7702 there).

## Components

### Wallet — `packages/crypto/evm`

-   `src/aa/Simple7702Upgrade.ts`: `toSimple7702SmartAccount({ client, owner })`; on first use `owner.signAuthorization` for the implementation address pinned in the registry; refuses any other implementation address; detects an existing delegation (`getCode` prefix `0xef0100…`) and checks it points at the pinned address.
-   `src/aa/BundlerClient.ts`: `createBundlerClient({ account, client, paymaster, transport: http(bundlerUrl) })`; bundler URL from the registry with the `CRYPTO_BUNDLER_URL_<CHAIN>` override.
-   `src/aa/CirclePaymaster.ts`: builds the permit (`signTypedData` for EIP-2612 on the USDC contract; spender = paymaster; value = fee ceiling; deadline per §2.4) and packs `paymasterData`; sets `paymasterVerificationGasLimit` / `paymasterPostOpGasLimit`.
-   `EvmAdapter` in `usdc-paymaster` mode:
    -   `estimateFee`: `pimlico_getUserOperationGasPrice` × gas → ETH cost → USDC at the Spike D rate source + Circle surcharge → `FeeQuote { amount (estimate), max (permit ceiling) }`;
    -   `transfer`: `sendUserOperation({ calls: [USDC.transfer], authorization? })`, returns the user-operation hash as `txId`;
    -   `getStatus`: `eth_getUserOperationReceipt`; on success, records the bundler transaction hash as `explorerHash` and reads the USDC transfer to the paymaster as the charged fee;
    -   fallback: bundler or paymaster error before submission → returns a typed error the UI turns into "pay fees in ETH instead?"; never silently switches mode.
-   Registry (`chains/baseSepolia.ts`): `features.paymaster = { kind: 'circle', version: '0.8', address, bundlerUrl }`, plus the pinned Simple7702 implementation address.

### Wallet — `packages/crypto/core`

-   `TxRecord.explorerHash` (F01) carries the bundler transaction hash for user operations.

### Wallet — `packages/crypto/ui`

-   Send form: fee-mode selector shown only when `features.paymaster` exists (F04); "up to N USDC" in `FeePreview`; "pay fees in ETH instead?" prompt on the typed fallback error.
-   History links user operations through `explorerHash`.

### Wallet — `app`

No change beyond F06 config overrides.

### Identity Service

No change.

### Demo

No change.

## Tests

-   Unit: paymaster data packing against a known vector; permit typed data (domain from the USDC contract's `name` / `version` / chain id); delegation detection (none / pinned / foreign address → refuse); fee quote math with surcharge and ceiling; error → fallback prompt.
-   Integration behind `CRYPTO_IT=1`: zero-ETH account sends 0.01 USDC with fee in USDC; charged fee ≤ quoted max.
-   Component: fee-mode selector visible only on paymaster chains; "up to N USDC" text.

## Specs and docs

-   `specs/wallet/20-Modules/` `crypto/evm` page: AA section (delegation, permit, fallback).

## Acceptance criteria

-   Zero-ETH send succeeds on the chosen testnet; History shows the charged USDC and an explorer link that opens the bundler transaction.
-   A foreign 7702 delegation on the account blocks USDC-fee mode with an explanation.
-   Bundler down → the holder is offered native mode; nothing is sent without their choice.

## Open questions

-   Rate source for the USDC quote (Spike D).
-   Revocation of the delegation as a user action (Settings) or only in the Phase 4 security test: decide in F15.
