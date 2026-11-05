# F09 — WalletConnect v2 dApp pairing (stretch)

-   **Phase:** 5.1
-   **Depends on:** F06, F07 (SignRequest screen reused)
-   **Gate:** none
-   **Design:** §2.8 F9, §2.10

## Goal

Pair the wallet with dApps through Reown WalletKit, using the CAIP ids the core already uses, so a relying party can request signatures and transactions without the custom `heka-sign` channel.

## Components

### Wallet — new package `packages/crypto/walletconnect`

-   WalletKit client; project id from config (a public id, not a secret, but still not committed as a default — set per build).
-   No screens here: the package exposes the WalletKit session and request events; screens are in `crypto/ui`.
-   Session proposal data: requester metadata, requested namespaces (`eip155:84532`, `eip155:296`), methods (`personal_sign`, `eth_signTypedData_v4`, `eth_sendTransaction`), accounts as CAIP-10.
-   Request handlers: sign methods → the F07 SignRequest screen; `eth_sendTransaction` → a confirm screen built on Send's fee preview; every request needs fresh auth.

### Wallet — `packages/crypto/core`

-   The signing-request model gains a `source` field (`heka-sign` or WalletConnect).

### Wallet — `packages/crypto/ui`

-   Session proposal screen; session list and disconnect in crypto Settings.
-   SignRequest shows the request source.

### Wallet — `app`

-   Scanner: `wc:` URIs → pairing (flag on only). Push / background handling of requests: decide during implementation.

### Identity Service

No change.

### Demo

-   Optional: the F14 demos switch from `heka-sign` to WalletConnect.

## Tests

-   Unit: namespace building, method routing, refusal of unsupported chains and methods.
-   Manual: pair with a public WalletConnect test dApp on Base Sepolia.

## Specs and docs

-   `specs/wallet/30-Features/`: WalletConnect page.

## Acceptance criteria

-   A test dApp pairs, receives the holder's address, gets a typed-data signature and a USDC transfer approved by the holder.

## Open questions

-   Hedera-native namespaces (`hedera:testnet`) only after F10.
