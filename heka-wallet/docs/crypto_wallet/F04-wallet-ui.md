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

-   Figma design for the payment screens: not referenced anywhere yet. UI work waits for it or uses existing wallet components as the design.
