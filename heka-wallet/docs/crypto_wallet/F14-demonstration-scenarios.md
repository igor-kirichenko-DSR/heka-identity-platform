# F14 — Demonstration scenarios

-   **Phase:** 3 (A, B, C); stretch (D)
-   **Depends on:** MVP (F00–F08); F12 for A and B; F13 for the revocation step of B; F07 for C and D
-   **Gate:** none
-   **Design:** §1 target use cases, §2.9

## Goal

Show the use cases end to end with the platform's own components: the Identity Service as issuer and verifier, Heka Wallet as holder and payer, a small relying-party or agent side in `demo/`.

## Decisions to take first

1.  **Payer-address binding** (how the relying party knows the paying address belongs to the credential holder):
    -   **Wallet-attested (recommended for the demos):** the F12 callback carries an EIP-191 signature by the payer over `reference|txId`; the relying party checks it and the on-chain transfer. Demo-side only.
    -   **Issuer-attested:** the KYC credential carries a CAIP-10 address claim, issued after the wallet proves control with a SIWE signature (F07). Needs an Identity Service issuance template and an issuer-side SIWE check; stronger, more work.
2.  **Binding branch** per scenario: payment account or `m/44'/60'/1'` (F03 open question). Recommendation: payment account for A–C (the same address pays and binds); binding branch only where a scenario needs an address that never holds funds.
3.  **Where the relying-party code lives:** extend `demo/a2a-oid4vp` for A; one new sub-project for B and C (proposal `demo/stablecoin-checkout`, Node + a minimal web page), following the demo's existing tooling.

## Scenarios

### A — Agentic payment with mandate and KYC (`demo/a2a-oid4vp`)

Today the agent asks for an OID4VP presentation through the Identity Service before it works on a task (`demo/a2a-oid4vp/README.md`). The extension:

-   The agent's task has a price. The agent creates a verification session with DCQL (mandate VC + KYC VC) and a `heka_payment_v1` transaction-data entry (F12) to the agent's receiving address on Base Sepolia.
-   The user presents and pays from Heka Wallet in one consent.
-   The agent receives the callback, checks the session result (verified, hashes matched) and the transfer on chain (viem public client: `Transfer` log with amount, recipient, payer), then completes the task.
-   Variant "agent pays the holder": the agent sends USDC to the holder's address after an in-task presentation; the agent's key comes from a local untracked env file, never from the repo.

Components: `demo/a2a-oid4vp/src/agent/` (payment tool, on-chain check), `src/a2a-oid4vp-extension.ts` (transaction data in the session request), README and diagram. Identity Service: F12 only.

### B — Compliance-gated stablecoin payment (`demo/stablecoin-checkout`)

-   Issuer: the Identity Service issues a KYC SD-JWT VC (with status, F13) to Heka Wallet.
-   Checkout page: "Pay 5 USDC" → verification session with KYC DCQL + payment transaction data → QR.
-   Wallet presents and pays; checkout shows "paid" after the callback and on-chain check.
-   Revocation step: the issuer revokes the KYC credential (F13); the next checkout fails at verification and no payment happens.

Components: new demo sub-project (server: session creation through the Identity Service API, callback endpoint, chain watcher; page: QR and status); Identity Service: F12, F13; wallet: none beyond F12.

### C — Payroll or expenses to a verified employee

-   An employee credential (Identity Service issuance template) is presented together with an F07 SIWE signature from the address to be paid (wallet-attested binding), or the address claim is in the credential (issuer-attested).
-   The employer script pays the registered address in USDC (an operator test key from a local untracked env file) and the employee sees it in History.

Components: same sub-project as B (a "register payout address" page and a payout script); Identity Service: a demo issuance template (configuration, not code, unless the issuer-attested option is chosen).

### D — Travel-Rule-aware transfer (stretch)

-   Before a transfer above a threshold, originator and beneficiary exchange credentials (OID4VP both ways through the Identity Service), and the beneficiary proves control of a self-hosted address by signing a nonce (F07 `personal_sign`).
-   Holder side only; no VASP integration.

Components: demo only; wallet: F07 already covers the nonce signature.

## Components (summary)

### Demo

-   A: extend `demo/a2a-oid4vp`. B, C: new sub-project. D: stretch.
-   Every demo reads chain ids, RPC URLs, contract addresses and the Identity Service URL from config, never hard-coded; no private keys or mnemonics in the repo.
-   A test signing-request issuer for F07 lives in the same sub-project as B and C.

### Identity Service

-   F12 and F13. Issuance templates for KYC, mandate and employee credentials as configuration. Issuer-attested address claims only if decision 1 picks that option.

### Wallet

-   No work beyond F07, F12 and the registry entries for demo assets (Phase 3.2).

## Tests

-   Each scenario: a scripted run (README steps) on testnets, recorded once per release.
-   Demo code: unit tests for the on-chain check (amount, recipient, payer, reference) and the callback signature check, following each demo's test setup (`demo/a2a-oid4vp` has none today — add a minimal runner or document manual verification, per `specs/demo/` testing notes).

## Specs and docs

-   `specs/demo/`: one page per new or extended demo.
-   Demo READMEs with sequence diagrams.

## Acceptance criteria

-   A and B run end to end on Base Sepolia (and A on Hedera testnet if F05 is in), with no manual step between presentation and payment.
-   B shows revocation blocking the payment.
-   No key, mnemonic or vendor API key is committed.
