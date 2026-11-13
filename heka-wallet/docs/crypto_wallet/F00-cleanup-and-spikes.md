# F00 — Keplr cleanup and spikes

-   **Phase:** 0
-   **Depends on:** nothing
-   **Gates:** Spike A gates F02 on viem; Spike B gates F05; Spike C gates F03; Spike D gates F08.
-   **Design:** §3 Phase 0

## Goal

Remove what the removed Keplr module left behind without breaking anything, and retire the four technical unknowns before any production code is written. Each spike ends with a short written result and a go / fallback decision.

## Components

### Wallet — `app`

Cleanup (one PR, before the spikes):

1.  `app/.env.example`: delete `ENABLE_KEPLR_INTEGRATION=false`. Nothing in `app/src` reads it.
2.  `.yarn/patches/react-native-scrypt-1.2.1.patch`: delete. `react-native-scrypt` is not in `yarn.lock` any more, so the patch is orphaned.
3.  `package.json` → `resolutions` → `"elliptic@npm:6.5.4": "6.6.1"`: **keep by default.** It is a security bump. Run `yarn why elliptic`; remove the line only if no package resolves `elliptic@6.5.4` any more.
4.  `app/shim.js`:
    -   `window.addEventListener` / `removeEventListener` / `dispatchEvent` on an `EventEmitter`: find the users. Grep the resolved dependencies (`node_modules/**`) for `window.addEventListener` and `dispatchEvent`, not just the app source. Remove only if nothing calls them; otherwise keep and add a one-line comment naming the user.
    -   `import '@ethersproject/shims'`: these are ethers v5 shims; the app uses ethers v6. Check whether any package still depends on `@ethersproject/*`; remove the import only if none does.
5.  Locale: move `Crypto.Register.Form.Password.Label` and `Crypto.Register.Form.Password.Invalid` to a neutral namespace (proposal: `PINConfirmation.Label`, `PINConfirmation.Invalid`) in `en`, `fr`, `pt-br`.

Spikes run from a throwaway screen behind a dev-only switch, on a spike branch that is not merged.

**Spike A — viem in React Native (gates F02).**

-   `generateMnemonic` → `mnemonicToAccount`; fund the address from the Base Sepolia faucet and the Circle USDC faucet.
-   Send ETH and USDC; read `Transfer` logs with `getLogs`.
-   Measure and record: shims needed beyond `react-native-get-random-values`; Hermes time for mnemonic → seed (PBKDF2, 2048 rounds) and for one signature, on a low-end Android device; release bundle size delta.
-   Record the largest `getLogs` block range the public Base Sepolia RPC accepts (input for F02's history window).
-   Fallback if viem fails: ethers v6 for F02, `permissionless` or hand-rolled user operations for F08.

**Spike B — Hedera through the JSON-RPC relay (gates F05).**

-   Same code against `eip155:296` (Hashio).
-   Send HBAR to a fresh `0x` alias; confirm auto-create on Mirror Node.
-   Send from that hollow account through the relay; confirm the first send completes it.
-   Send USDC `0.0.429274` to the auto-created account (HIP-904) and to a `CryptoCreate` account after `associate()` through the HIP-719 facade.
-   Record: gas used for HBAR, HTS transfer and `associate()`; `eth_gasPrice` units; EIP-1559 support; receipt latency; Mirror Node lag behind the relay receipt.
-   Compute the long-zero address of `0.0.429274` and confirm it on HashScan.
-   Nice-to-have: import the phrase into HashPack / Blade.

**Spike C — keys in Askar (gates F03).**

-   Write and read the seed record through the main agent in both ways: Credo `GenericRecordsApi` (tag `type: 'crypto-seed'`) and a raw Askar session (`category: 'crypto'`). Pick one.
-   Check that the DC API agent (`app/src/utils/createDcApiAgent.ts`), which opens the same store, neither lists nor corrupts the record.
-   Check behaviour on lock / unlock, on PIN change (store rekey) and after a passkey backup + restore on a second device.
-   Decision: Askar record, or the `expo-secure-store` keystore fallback (§2.5).

**Spike D — gas paid in USDC (gates F08).**

-   On Base Sepolia: `toSimple7702SmartAccount` + `signAuthorization`, Pimlico's public bundler, Circle Paymaster v0.8 with an EIP-2612 permit.
-   Send USDC from an account that holds **zero ETH**.
-   Choose the rate source for the USDC fee quote; compare 10 quotes with the USDC actually charged in receipts.
-   If Paymaster v0.8 is not live on Base Sepolia, repeat on Arbitrum Sepolia and record the fallback.
-   Revoke the delegation (authorize to the zero address) and confirm plain EOA sends still work.

### Wallet — `packages/shared`

-   `components/modals/ConfirmationInputModal.tsx`: switch the two keys to the new namespace (cleanup step 5).

### Identity Service

No change.

### Demo

No change.

## Tests

-   Cleanup: `yarn typecheck && yarn lint && yarn test` at `heka-wallet/`; Android and iOS debug builds start; existing Maestro flows (`.maestro/*.yaml`) pass, including `change-pin.yaml` and `pin-lockout.yaml`, which show `ConfirmationInputModal`.
-   Spikes: no automated tests; results are written down.

## Specs and docs

-   Spike results: one short section per spike appended to this file (or a `spikes/` subfolder), with the numbers measured.
-   `specs/wallet/10-Architecture/Build-and-Tooling.md`: update the yarn patches list and the shim description if they change.

## Acceptance criteria

-   No Keplr reference is left in `app/.env.example` or `.yarn/patches/`.
-   `elliptic` resolves to 6.6.1 or later everywhere (`yarn why elliptic`).
-   The PIN confirmation modal shows the same label and error text as before.
-   Each spike has a recorded result and a go / fallback decision; the design's §4 risks are updated with the numbers.

## Results

### Cleanup (2026-11-05)

1.  `ENABLE_KEPLR_INTEGRATION` removed from `app/.env.example`.
2.  `react-native-scrypt-1.2.1.patch` deleted. `yarn.lock` did not change.
3.  `elliptic` resolution **removed**. The only consumer, `@ethersproject/signing-key@5.8.0`, asks for `6.6.1` itself; nothing asks for `6.5.4`. `yarn why elliptic` shows `6.6.1` only.
4.  `app/shim.js`:
    -   `window` event shims **kept**. Method: grep of an unminified release bundle (`react-native bundle --dev false --minify false`), because a grep of `node_modules` hits many files that are never bundled. One real user: `kotlinx-coroutines` inside `@sphereon/kmp-mdoc-core`. It picks its default dispatcher by `typeof window.addEventListener`: with the shim it uses `WindowDispatcher`, without it `NodeDispatcher`. Removing the shim would change how mdoc code schedules coroutines. Other matches (React `reportGlobalError`, `node-forge`, axios, the `setImmediate` polyfill) only run when `window.ErrorEvent` or `window.postMessage` exists; React Native has neither.
    -   Risk found: `WindowDispatcher` calls `window.postMessage` to yield after a batch of queued tasks. React Native has no `window.postMessage`, so a long coroutine batch would throw. Not seen so far. Follow-up: test whether `NodeDispatcher` (no shim) works for mdoc, then drop the shim.
    -   `@ethersproject/shims` **kept**: `@hashgraph/sdk@2.78.0` depends on `@ethersproject/abi`, `bignumber`, `bytes`, `rlp` (ethers v5).
5.  `Crypto.Register.Form.Password.Label` / `.Invalid` moved to `PINConfirmation.Label` / `.Invalid` in `en`, `fr`, `pt-br`. Same texts. `ConfirmationInputModal` uses the new keys.

Checks: `yarn typecheck`, `yarn lint`, `yarn test` pass at `heka-wallet/`. Android debug build: runs (all spikes ran on it). Not yet run: iOS debug build; the Maestro flows `change-pin.yaml` and `pin-lockout.yaml` (they are on `main`, not on the spike branch: run them on the branch the cleanup is cherry-picked to).

### Spikes A–D (2026-11-05 – 2026-11-06)

Run from the dev-only "Crypto spikes" screen on branch `spike/crypto-wallet-f00` (not merged). Device: Huawei P30 Pro (2019 flagship, Kirin 980), **debug build**, plus one release build (`ENABLE_CRYPTO_SPIKE=true`) for the A1 timings. A budget phone will be slower. Detailed write-up with code examples: [F00-spikes-report.md](F00-spikes-report.md).

#### Spike A — viem in React Native: **go**, with conditions

| Measurement | Result |
| --- | --- |
| Shims beyond `react-native-get-random-values` | none — Hermes has `crypto.getRandomValues`, `TextEncoder`/`TextDecoder`, `BigInt`, `structuredClone`, `AbortController`, `URL`, `fetch`, `WebSocket` (with the existing `app/shim.js`) |
| Mnemonic → seed, viem `mnemonicToAccount` (pure-JS PBKDF2) | **7.7–10.3 s** per call (debug); **3.1 s** (release) |
| Mnemonic → seed, native PBKDF2-SHA512 (`react-native-quick-crypto`, already in the app) | **5 ms** (debug), **1.8 ms** (release); same address |
| BIP-32 derivation per account (`HDKey` + `hdKeyToAccount`) | 85–94 ms (debug), 62–64 ms (release); ≈ 650 ms on the first call after start in both |
| `signTransaction` (EIP-1559) / `signTypedData` / `signMessage` | 35 / 46 / 97 ms (debug); 18 / 22 / 62 ms (release) |
| ETH send, Base Sepolia | sign + broadcast 0.98 s, receipt 1.9 s, 21 000 gas at 0.006 gwei; L1 data fee 165 wei |
| USDC send, Base Sepolia | sign + broadcast 0.95 s, receipt 1.2 s, 62 147 gas |
| Largest `getLogs` range, public `https://sepolia.base.org` | **200 blocks** (≈ 6.7 min); reading 10 000 blocks in 200-block chunks takes 8.6 s per filter |
| JS bundle, minified production (Hermes bytecode) | `viem` + `viem/accounts` + `viem/account-abstraction`: +1.97 MB JS (+5.2 %), +2.61 MB HBC (+5.7 %); the `viem/chains` index adds ≈ 0.75 MB JS more (Metro does not tree-shake) |
| Release APK size | +2 408 760 B (+2.4 MB) for viem (core + `viem/chains` index) and the spike code: the Hermes bundle, stored uncompressed in the APK, grows from 24 631 212 to 27 039 972 B (+9.8 %); APK 230 509 220 B (+1.0 %) |

Conditions for F02 / F03:

-   Compute the seed with the native PBKDF2 and hand it to viem's `HDKey`; never call `mnemonicToAccount` in the app.
-   Import chain definitions one by one (or `defineChain`), not the `viem/chains` index.
-   `tsconfig.json` needs `paths` for `ox` → `ox/_types` (with `moduleResolution: "node"` viem's `ox/*` imports resolve to `.ts` sources and typecheck fails).
-   Give viem account types explicitly at generic boundaries: inferring `HDAccount` through a generic helper crashed `tsc` ("out of memory: Zone", really a stack overflow).
-   History cannot come from public-RPC `getLogs`: needs a keyed RPC or an indexer (F11).

Fallback (ethers v6): not needed.

#### Spike B — Hedera through the JSON-RPC relay: **go**, with conditions

| Measurement | Result |
| --- | --- |
| HBAR to a fresh `0x` alias | auto-creates a **hollow** account (no key), max auto associations −1 |
| First send from a hollow account through the relay | **completes it** — the key appears on Mirror Node afterwards |
| HTS token to the auto-created account without association (HIP-904) | works (test token; Circle faucet limit) |
| `associate()` through the HIP-719 facade on a `CryptoCreate` account (max auto associations 0), then receive | works |
| Gas / fee (effective 123–124 tinybar per gas) | plain HBAR transfer 21 000 gas, 0.026 HBAR; HTS transfer 36 868 gas, 0.045 HBAR; HBAR send that auto-creates the recipient 607 856 gas, 0.75 HBAR; `associate()` 726 488 gas, 0.89 HBAR |
| Fees outside the relay (SDK) | `CryptoCreate` 0.73 HBAR; `TokenCreate` 14.6 HBAR |
| `eth_gasPrice` units | 18-decimal weibar (1 300 000 000 000 = 130 tinybar per gas) |
| EIP-1559 | supported: transactions go out as type 2; `eth_feeHistory` answers |
| **Unit inconsistency** | `baseFeePerGas` came back as 1 240 000 000 000 (weibar) in one call and 124 (tinybar) in another |
| Relay receipt latency | 7–73 s (Hashio; varied a lot within one hour) |
| Mirror Node lag behind the relay receipt | 75–207 ms (1.5 s for an SDK-created account) |
| USDC `0.0.429274` long-zero address | `0x0000000000000000000000000000000000068cda` — `symbol()` USDC, `decimals()` 6 through the relay; matches Mirror Node / HashScan token "USD Coin" |
| `@hashgraph/sdk` in React Native | `CryptoCreate` and `TokenCreate` work from the app (2.81.0, the copy `@credo-ts/hedera` ships) |

Conditions for F05: check units per call at the edge (`crypto/evm/hedera/`), a pending state that tolerates tens of seconds, a fee preview per operation type (auto-create and `associate()` cost ~30× a plain transfer), Hashio for dev only.

Not done: a transfer with real USDC. The Circle faucet answered "Tokens sent" on 2026-11-06 but nothing reached `0.0.11338782` (Mirror Node, 10 min); closed without it, since the test token covers the same HTS paths and B1 confirmed USDC's address and decimals. HashPack / Blade import (nice-to-have) not tried.

Note: `@hashgraph/sdk` 2.81.0 is its last release; development continues as `@hiero-ledger/sdk`. The app gets no further fixes on the SDK it ships until Credo moves.

#### Spike C — keys in Askar: **go, raw Askar session entry**

| Measurement | Result |
| --- | --- |
| Write: `GenericRecordsApi.save` (tag `type: 'crypto-seed'`) / raw session insert (`category: 'crypto'`) | 12.9 / 11.3 ms |
| Read: generic `findById` / raw `fetch` | 24–180 / 12–17 ms |
| DC API agent opening the same store | **sees** the record both ways (`getAll()`, tag query, raw category); does not corrupt it |
| PIN change (store key rotated) | both records intact, in the running agent and after a full restart with the new PIN |
| Lock / unlock (app restart) | both records intact |
| Passkey backup + restore, second device | not checked — `ENABLE_WALLET_BACKUP=false` on this build; no second device |

Decision: **raw Askar session entry** (`category: 'crypto'`, `name: 'seed'`) — no Credo API lists the category, and it reads faster than a generic record. The `expo-secure-store` fallback (§2.5) is not needed. For the Phase 4.1 review: the main agent and the DC API agent are separated by code, not by the store — any agent holding the store key can read the seed.

#### Spike D — gas paid in USDC: **go on Base Sepolia**

| Measurement | Result |
| --- | --- |
| Contracts on Base Sepolia and Arbitrum Sepolia | Circle Paymaster v0.8 `0x3BA9…8966`, EntryPoint 0.8 `0x4337…F108`, Simple7702 `0xe6Ca…555B` deployed |
| USDC send from an account with **0 ETH** | 11 sends, all success (Pimlico keyed endpoint) |
| First send (with the 7702 authorization) | 259 670 gas; fee **0.005131 USDC**; receipt 3.1 s |
| Later sends | 199 911 gas each (≈ 3.2 × a plain USDC transfer); fee **0.004046 USDC** each; receipt 1.3–2.5 s |
| How the paymaster charges | pulls a prefund (0.00903 USDC) and refunds the unused part (0.004984) in the same transaction — read the **net** |
| Rate source for the fee quote | Circle's effective rate 3 345 USDC/ETH. Pimlico `pimlico_getTokenQuotes` quotes for Pimlico's own paymaster: **−26 %** (−19 % with Circle's 10 % surcharge). The rate implied by the previous receipt is exact from the second send on |
| Revocation (authorize to the zero address) | type-4 transaction sent by another account, 36 800 gas; code empty afterwards; plain EOA send works after it |

Decision for F08: quote "≈ gas × the Circle rate from the last receipt", with the prefund as the "up to" ceiling (≈ 2.3 × the real fee); not Pimlico's token quote. Arbitrum Sepolia fallback not needed.

## Open questions

-   Who funds the shared test accounts used by integration tests and spikes, and where their keys live (local untracked env file per developer, or a team secret store).
