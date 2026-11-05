# F11 — EURC, more ERC-20 assets, price feed, indexer history (stretch)

-   **Phase:** 5.3
-   **Depends on:** F01, F02, F04
-   **Gate:** none
-   **Design:** §2.8 F11, §2.10

## Goal

More assets as registry configuration, an optional fiat value next to balances, and complete history where `getLogs` is not enough.

## Components

### Wallet — `packages/crypto/evm`

-   `chains/baseSepolia.ts`: EURC as an asset entry (address from Circle's EURC list), `stable: 'EUR'`.
-   Indexer history source (`historySource: 'indexer'`): a client for one indexer API chosen at the time (keyless or behind the operator proxy, never a key in the app); covers inbound native transfers and history older than the `getLogs` window.

### Wallet — `packages/crypto/core`

-   `PriceStore` (optional, off by default): fiat values for `stable` assets are 1:1 by definition; other assets need a feed, decided at the time; no third-party feed is called while the feature is off.
-   `ChainDescriptor` exposes whether history is complete (indexer source) so the UI need not know source types.

### Wallet — `packages/crypto/ui`

-   History drops the "may be partial" note on chains with complete history; balances show the fiat value when `PriceStore` is on.

### Wallet — `app`

-   Config entries for the indexer URL and the price-feed switch.

### Identity Service

No change.

### Demo

-   Euro-denominated demo payments can use EURC once it is in the registry.

## Tests

-   Unit: registry with EURC; indexer response mapping (recorded fixtures); price store off → no network calls.

## Acceptance criteria

-   EURC appears, sends and receives on Base Sepolia with no code change outside the registry.
-   With an indexer configured, an inbound ETH transfer appears in History.
