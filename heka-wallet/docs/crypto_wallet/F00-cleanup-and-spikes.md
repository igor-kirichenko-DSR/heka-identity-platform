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

## Open questions

-   Who funds the shared test accounts used by integration tests and spikes, and where their keys live (local untracked env file per developer, or a team secret store).
