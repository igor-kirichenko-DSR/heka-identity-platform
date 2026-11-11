# F06 — Host wiring: flag, provider, tab, scanner, onboarding, localisation

-   **Phase:** 2 (`en`), 3 (`fr`, `pt-br`)
-   **Depends on:** F04 (re-ordered 2026-11-10: the signing-request route moved to F07, which comes after F06)
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
-   `app/App.tsx`: `<CryptoProvider>` mounted only when the flag is on; it creates the registry and registers `EvmAdapter(baseSepolia)` (or `arbitrumSepolia` per Spike D) and `EvmAdapter(hederaTestnet)` (if Spike B passed). Its props (F04 "Decisions"): the adapters, `createAgentTransactionRunner(mainAgent)` for the seed, the ledger session, the logger, the default chain, `backup` only when `isWalletBackupEnabled`, and `isAgentReady` (false while the main agent's store is not open).
-   `app/src/navigators/TabStack.tsx`: a fourth tab ("Payments") appended to `tabBarVisualOrder` when the flag is on; `TabStacks` gains `CryptoStack`.
-   `app/src/navigators/types.ts`: `CryptoStackParams`; the tab id.
-   Scanner and deep links (`app/src/utils/useInvitationHandlers.ts`, `useDeeplinks.ts`):
    -   `ethereum:` URIs → Send, prefilled from EIP-681 (chain must be in the registry, else an error);
    -   only when the flag is on; everything else keeps today's path;
    -   the routing is one place F07 extends with signing-request URIs → SignRequest.
-   Onboarding (`app/src/navigators/OnboardingScreens.tsx`): one optional page about payments, behind the flag.
-   Localisation (`app/src/localization/{en,fr,pt-br}/index.ts`): rewrite `Crypto.*` — drop Cosmos strings (bech32, staking, Ledger, "cosmic interchain"), add chain, asset, fee mode, activation, history-partial, backup prompt, reveal and remove warnings (signing-request strings come with F07). `en` complete in Phase 2; `fr` and `pt-br` in Phase 3. Run the project's i18next parser config (`app/i18next-parser.config.js`) to catch missing keys.

### Wallet — `packages/crypto/ui`

-   Exports `CryptoProvider`, `CryptoStack` and the navigation helper the app's URI handler calls (open Send prefilled); F07 adds open SignRequest.

### Wallet — `packages/crypto/core`

-   Exports the URI parser (`ethereum:` EIP-681) the app uses to decide where a scanned value goes.

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
-   Unit: scanner routing — `ethereum:` URIs go to the crypto stack only with the flag on; DIDComm and OID4VC URIs unchanged.
-   Maestro: existing flows pass with the flag off; the F04 flows in `.maestro/crypto/` run with the flag on. Give the tab the testID `TabPayments` (the flows tap it) and add `crypto/*.yaml` to `.maestro/config.yaml`.

## Specs and docs

-   `specs/wallet/50-Platform/Config-and-Flags.md` (currently "Pending"): write it, including the new variables.
-   `specs/wallet/90-Change-Guide/Change-Impact-Map.md`: tab order, scanner routing.
-   `specs/wallet/30-Features/Navigation-and-Screens.md`: the fourth tab.

## Decisions

Agreed 2026-11-11 (DSRDSC-293):

-   Only `baseSepolia` is registered. `hederaTestnet` (F05) and `arbitrumSepolia` (F08) do not exist yet; F05 / F08 add their registration and their `CRYPTO_*_<CHAIN>` names to `app/src/cryptoConfig.ts`.
-   `CryptoProvider` takes `createAdapters(addressBook)` instead of ready adapters: `EvmAdapter` reads cached addresses from the key provider the provider builds. `CryptoHost` (`app/src/components/crypto/`) and `useCryptoHost` supply the props; the agent and the backup are reached through refs because services are built once.
-   `getCryptoConfig` runs lazily from `useCryptoHost`, so a bad `CRYPTO_*` value cannot stop an app with the module off. Overrides: `https://` only (`http://` in `__DEV__`); an unregistered `CRYPTO_DEFAULT_CHAIN` falls back to Base Sepolia with a warning. `CRYPTO_BUNDLER_URL_*` is parsed, unused until F08.
-   Links: the scan tab, deep links and basic-message links all end in `handleInvitationUrl`, so the `ethereum:` check lives there (`utils/cryptoLinks.ts`, F07 extends it). A link switches the chain to the one it names, then opens Send. No OS URL scheme is registered for `ethereum:`; only scans and in-app links reach it.
-   The onboarding page reuses the wallet illustration. French and Portuguese strings are by the agent; a native speaker should check them.
-   `CryptoStack` takes `bottomInset`: the tab bar floats over the screens, so `TabStack` passes its height plus margin, as `Home` pads its bottom. Found by the first device run, with three more defects (agent ref timing in `useCryptoHost`, a redirect in `VerifyMnemonicScreen` that dropped the Done screen, unquoted Maestro `evalScript`); each has a regression test.
-   Maestro: `crypto/*.yaml` added to the workspace config; the flows need a build with `ENABLE_CRYPTO_MODULE=true`. `crypto-register`, `crypto-import` and `crypto-receive` passed on a connected Android phone (debug build, flag on, 2026-11-11); `crypto-send` and the backup → restore check were not run.

## Acceptance criteria

-   Flag off: no crypto provider mounted, three tabs, scanner behaviour unchanged, bundle may still contain the packages.
-   Flag on: the Payments tab works end to end on the enabled chains.
-   No vendor key or private key appears in `.env.example` or in config defaults.
-   A seed survives backup → restore on a second device and derives the same addresses (moved from F03, agreed 2026-11-10).
