# F06 — Host wiring: flag, provider, tab, scanner, onboarding, localisation

-   **Phase:** 2 (`en`), 3 (`fr`, `pt-br`)
-   **Depends on:** F04, F07 (for the signing-request scanner route)
-   **Gate:** none
-   **Design:** §2.7

## Goal

Plug the module into the app behind `ENABLE_CRYPTO_MODULE`, so that with the flag off the app behaves exactly as it does today.

## Components

### Wallet — `app`

-   `app/src/config.ts`:
    -   `isCryptoModuleEnabled = Config.ENABLE_CRYPTO_MODULE === 'true'`;
    -   `cryptoConfig = { defaultChain: Config.CRYPTO_DEFAULT_CHAIN ?? 'eip155:84532', chains }`, where `chains` is the built-in registry with per-chain `CRYPTO_RPC_URL_<CHAIN>` and `CRYPTO_BUNDLER_URL_<CHAIN>` overrides (`<CHAIN>` = `BASE_SEPOLIA`, `HEDERA_TESTNET`, `ARBITRUM_SEPOLIA`); invalid or `http://` overrides refused outside `__DEV__`.
-   `app/.env.example`: `ENABLE_CRYPTO_MODULE=false`, `CRYPTO_DEFAULT_CHAIN=`, the override names with empty values, one variable per line.
-   `app/App.tsx`: `<CryptoProvider>` mounted only when the flag is on; it creates the registry and registers `EvmAdapter(baseSepolia)` (or `arbitrumSepolia` per Spike D) and `EvmAdapter(hederaTestnet)` (if Spike B passed).
-   `app/src/navigators/TabStack.tsx`: a fourth tab ("Payments") appended to `tabBarVisualOrder` when the flag is on; `TabStacks` gains `CryptoStack`.
-   `app/src/navigators/types.ts`: `CryptoStackParams`; the tab id.
-   Scanner and deep links (`app/src/utils/useInvitationHandlers.ts`, `useDeeplinks.ts`):
    -   `ethereum:` URIs → Send, prefilled from EIP-681 (chain must be in the registry, else an error);
    -   signing-request URIs (F07) → SignRequest;
    -   both only when the flag is on; everything else keeps today's path.
-   Onboarding (`app/src/navigators/OnboardingScreens.tsx`): one optional page about payments, behind the flag.
-   Localisation (`app/src/localization/{en,fr,pt-br}/index.ts`): rewrite `Crypto.*` — drop Cosmos strings (bech32, staking, Ledger, "cosmic interchain"), add chain, asset, fee mode, activation, history-partial, backup prompt, reveal and remove warnings, signing-request strings. `en` complete in Phase 2; `fr` and `pt-br` in Phase 3. Run the project's i18next parser config (`app/i18next-parser.config.js`) to catch missing keys.

### Wallet — `packages/crypto/ui`

-   Exports `CryptoProvider`, `CryptoStack` and the navigation helpers the app's URI handlers call (open Send prefilled, open SignRequest).

### Wallet — `packages/crypto/core`

-   Exports the URI parsers (`ethereum:` EIP-681, signing request) the app uses to decide where a scanned value goes.

### Wallet — `packages/crypto/evm`

-   Exports the chain entries (`baseSepolia`, `hederaTestnet`, `arbitrumSepolia`) and `EvmAdapter`, which `App.tsx` registers.

### Wallet — `packages/shared`

No change (the locale key move is F00).

### Identity Service

No change.

### Demo

No change.

## Tests

-   Unit: `config.ts` parsing (flag on / off, override present / absent / invalid).
-   Component: `TabStack` renders three tabs with the flag off and four with it on.
-   Unit: scanner routing — `ethereum:` and signing-request URIs go to the crypto stack only with the flag on; DIDComm and OID4VC URIs unchanged.
-   Maestro: existing flows pass with the flag off; `crypto-register.yaml` runs with the flag on.

## Specs and docs

-   `specs/wallet/50-Platform/Config-and-Flags.md` (currently "Pending"): write it, including the new variables.
-   `specs/wallet/90-Change-Guide/Change-Impact-Map.md`: tab order, scanner routing.
-   `specs/wallet/30-Features/Navigation-and-Screens.md`: the fourth tab.

## Acceptance criteria

-   Flag off: no crypto provider mounted, three tabs, scanner behaviour unchanged, bundle may still contain the packages.
-   Flag on: the Payments tab works end to end on the enabled chains.
-   No vendor key or private key appears in `.env.example` or in config defaults.
-   A seed survives backup → restore on a second device and derives the same addresses (moved from F03, agreed 2026-11-10).
