# F04 — Wallet UI: register, home, receive, send, history, settings

-   **Phase:** 2
-   **Depends on:** F01, F02, F03; F05 and F08 for their chain- and fee-specific parts
-   **Gate:** none (Hedera and USDC-fee parts appear only when their spikes passed)
-   **Design:** §2.6, §3 Phase 2

## Goal

The holder's screens for the payment module, reusing the Keplr-era UX where it fits and the wallet's existing components and theme.

## Scope

-   In: Register (create / verify / import), Home, Receive, Send, History, Settings, RevealPhrase. SignRequest is in F07.
-   Out: WalletConnect screens (F09), price display (F11).

## Components

### Wallet — `packages/crypto/ui` (new)

Scaffold: `package.json` name `@heka-wallet/crypto-ui`, `private: true`, `main: ./src/index.ts`; depends on `@heka-wallet/crypto-core` and `@heka-wallet/shared` (workspace), React Native, Bifold theme and i18n at the versions the app pins; exact versions. Root `jest.config.js`: project `@heka-wallet/crypto-ui` with `getTestRegexForPath('packages/crypto/ui')`. It never imports `crypto/evm`: adapters come from the registry in `CryptoProvider`.

`src/navigators/CryptoStack.tsx`: `Main` (Home, Send, Receive, History, Settings, RevealPhrase, SignRequest) and `Register` (Intro, NewMnemonic, VerifyMnemonic, Import, Done).

Screens:

-   **Register:** intro (create or import) → `NewMnemonic` (12 words, `WordsCard`; screenshot blocked) → `VerifyMnemonic` (tap-to-order with `WordChip`) → Done (backup prompt from F03). Import: mnemonic (word count and checksum validation) or raw hex key. Rebuilt from the Keplr screens in git history before PR #229; Cosmos-specific parts (bech32, HD path editor, Ledger) are dropped.
-   **Home:** per-asset balances for the current chain; chain switcher; address with copy; Receive and Send buttons; pull-to-refresh. Hedera: activation-pending banner and "Enable USDC" (F05). Paymaster chains: no extra UI here.
-   **Receive:** EIP-55 address, QR with an EIP-681 URI (chain id; token contract for USDC); asset picker changes the URI; Hedera shows `0.0.x` next to `0x` once active.
-   **Send:** asset picker → recipient (`AddressField`: checksum, QR scan, new-recipient warning when the address is not in the ledger) → amount (`AmountInput`, bigint-safe, "max" leaves room for the fee in native mode) → fee mode (`ETH` / `USDC` where `features.paymaster`, `HBAR` on Hedera) → `FeePreview` ("up to N USDC" in paymaster mode) → confirm with PIN / biometry → pending entry → final with explorer link. Blocked with a clear message when the fee asset balance is short.
-   **History:** ledger + chain entries, newest first, paged; status chips; explorer link per entry; on EVM chains a note that older and inbound native transfers may be missing.
-   **Settings:** default chain; reveal phrase (auth → `RevealPhrase`); remove wallet (F03, shows balances and the warning).
-   **RevealPhrase:** words shown after fresh auth; screenshot and recording blocked; no copy button; auto-hide on background.

Keys (moved from F03, agreed 2026-11-10):

-   `CryptoProvider` subscribes to the app's lockout state (Bifold `store.authentication.didAuthenticate`, `AgentLockout` context) and calls `KeyProvider.lock()` / `unlock()`; it builds the `SeedKeyProvider` over `AskarSeedStore(createAgentTransactionRunner(mainAgent))` and keeps the only `AuthProofIssuer`.
-   `useAuthProof` hook: wraps `ConfirmationInputModal` / `PinConfirmation` and `authenticateByBiometry` from `packages/shared` and returns an `AuthProof` after a successful check. Used by RevealPhrase, remove wallet and Send.
-   Done screen: if `isWalletBackupEnabled` (`app/src/config.ts`) is true, "back up now" opens the existing backup flow (`BackupStack`, `useWalletBackupHelpers.backupWallet`); if false, the done screen says the verified phrase is the backup.
-   A raw-key wallet (`seedKind() === 'raw'`) hides reveal and anything that needs the binding branch.

Components (`src/components/`): `AmountInput`, `AddressField`, `AssetPicker`, `FeePreview`, `WordsCard`, `WordChip`, `ChainSwitcher`, `TxListItem`, `ActivationBanner`. One component per file; logic in hooks (`src/hooks/`); every interactive element has a `testID`.

### Wallet — `packages/crypto/core`

-   No screens or React code. Any state a screen needs that the stores do not expose yet is added to the store (with a unit test), not computed in the screen.

### Wallet — `packages/crypto/evm`

No change.

### Wallet — `app`

-   Screenshot protection on `NewMnemonic` and `RevealPhrase`: check if the app already has a mechanism; if not, add one (Android `FLAG_SECURE` via a small native module or a maintained package pinned exactly; iOS: hide content on `AppState` inactive and when screen capture is detected).
-   Wiring of the stack and the tab is F06.

### Identity Service

No change.

### Demo

No change.

## Tests

-   Component tests (Jest + Testing Library) per screen: validation states, disabled confirm, fee-short state, Hedera banner, paymaster fee mode visibility.
-   Hook tests for send form logic (amount + fee ≤ balance, max button).
-   Maestro flows (`heka-wallet/.maestro/`): `crypto-register.yaml` (create + verify), `crypto-import.yaml`, `crypto-receive.yaml` (QR visible, address copy), `crypto-send.yaml` (against a funded test account, run on demand; skipped in default CI).

## Specs and docs

-   `specs/wallet/30-Features/Navigation-and-Screens.md`: the crypto stack and screens.
-   `specs/wallet/80-Visual/`: Figma frames when design exists.

## Acceptance criteria

-   A new user can create a wallet, receive USDC, send USDC and see both in History on Base Sepolia without leaving the app.
-   No screen shows a balance or amount computed with floating point.
-   The phrase cannot be captured by a screenshot on Android.

## Open questions

-   Figma design for the payment screens: not referenced anywhere yet. F04 uses the existing wallet components and theme as the design; screens are restyled when a design exists.

## Decisions

Agreed 2026-11-10 (DSRDSC-293):

-   One task, seven iterations; one wallet commit. The verify step asks for 4 of the 12 words (`VERIFY_WORD_COUNT`), as the Keplr screen did. `crypto/core` gains `WalletStore` (seed status none / mnemonic / raw; import and remove reload the accounts), `TransactionStore.isKnownRecipient` (the new-recipient warning) and `generatePhrase`.
-   A new phrase is kept in memory and stored with `importSeed` only after the tap-to-order check. `createSeed` would store it before the check, so a holder who quits on the verify screen would keep a phrase they never confirmed. The phrase never travels in route params; it lives in a register-flow context and is dropped on the Done screen.
-   `CryptoProvider` takes everything app-specific as props (adapters, seed and ledger session runners, logger, default chain, optional backup, `isAgentReady`); `crypto-ui` imports neither `app` nor `crypto-evm` (ESLint). It locks the keys and polling when Bifold's `didAuthenticate` is false or the agent is not ready, and builds its services once.
-   Default chain: AsyncStorage key `crypto.defaultChain` (a chain id, not a secret), behind `ChainPreference`.
-   Extra screens not in the list above: `ScanAddress` (Bifold `ScanCamera`; an EIP-681 request fills recipient, asset and amount; another chain's request is refused) and `RemoveWallet` (balances, warning, PIN or biometry).
-   Screenshot protection: Bifold `usePreventScreenCapture` (`react-native-screenguard`, already linked), on NewMnemonic, VerifyMnemonic, ImportWallet and RevealPhrase; the words (and the pasted secret) are also blanked while the app is in the background. No new native module.
-   `useAuthProof`: biometry first when the holder turned it on, PIN (`PinConfirmation`) otherwise or after a biometry failure. Send, reveal, remove and "Enable USDC" ask for it.
-   Hedera and paymaster parts are built from adapter capabilities only (`activationState`, `isAssetEnabled`, `enableAsset`, `features.paymaster`) and tested on a fake adapter. Hedera `0.0.x` on Receive needs an account-id read in the adapter interface: left to F05.
-   Strings: the `Crypto.*` block is rewritten in `en`, `fr` and `pt-br` (French and Portuguese by the agent; a native speaker should check them). F06 adds only its own keys.
-   Maestro: `.maestro/crypto/crypto-{register,import,receive,send}.yaml`, outside the workspace's top-level `*.yaml`, so no suite runs them before F06 adds the Payments tab (`TabPayments`). F06 runs them first and owns the device checks of acceptance criteria 1 and 3. `crypto-send.yaml` (tag `crypto-onchain`) is on demand with a funded key from a local env file.
