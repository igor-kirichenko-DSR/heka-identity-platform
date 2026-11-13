# Payments: how to check the main flows

For a developer or tester with an Android phone, a debug build and Metro. Covers what F01–F06 deliver: one chain (Base Sepolia), ETH and USDC, no Hedera or paymaster yet. Screen texts are the English strings in `app/src/localization/en/index.ts` -> `Crypto`.

## Before you start

1.  `app/.env`: `ENABLE_CRYPTO_MODULE=true`. Leave `CRYPTO_*` empty to use the built-in public RPC. A changed `.env` needs a native rebuild: `yarn run:android` in `heka-wallet/`, not a Metro reload. Values stay on one line.
2.  Metro running, phone connected (`adb devices` shows `device`), USB debugging allowed.
3.  Never use a funded personal key. For flows that move funds, use a test account funded from a Base Sepolia faucet. Keep its key in a local, untracked file; never in the repo, `.env.example` or a chat.
4.  Fresh start for flows 1–3: clear the app's data (or let Maestro do it, see "Automated run").

## 1. The tab is there (or not)

| Step | Expected |
|---|---|
| Flag on: open the app, enter the PIN | four tabs: Scan, Credentials, Payments, Settings |
| Flag off, rebuild | three tabs, no payments onboarding page; the wallet behaves as before |
| Flag on, fresh install, walk the onboarding | one extra page "Payments, kept separate" before the last page |

## 2. Create a wallet

| Step | Expected |
|---|---|
| Payments tab | "Payment wallet" with Create new wallet / Import existing wallet |
| Create new wallet | "Write down your recovery phrase": 12 numbered words. A screenshot is blocked or black; sending the app to the background hides the words |
| I have written it down | "Check your recovery phrase": four words are missing |
| Tap the missing words in the right order | Continue stores the wallet; a wrong order shows "The words are not in the right order" and nothing is stored; Start over resets |
| Continue | "Your wallet is ready". With wallet backup on, a "Back up now" button; otherwise a note that the phrase is the backup |
| Open wallet | Home with ETH and USDC rows, address, chain name |

Check also: kill the app on the phrase screen, reopen: no wallet exists and you start again (the phrase is never stored before the check).

## 3. Import a wallet

| Step | Expected |
|---|---|
| Import existing wallet, enter 12 or 24 words | Import opens Home; the address equals the one the same phrase gives in any BIP-39 wallet at `m/44'/60'/0'/0/0` |
| Enter a wrong word count, a bad checksum, or `0x` plus a short key | the matching error text, nothing stored |
| Enter `0x` plus 64 hex characters | Home opens; Settings has no "Show recovery phrase" (a raw key has no phrase) |

## 4. Receive

| Step | Expected |
|---|---|
| Home -> Receive | QR code and the full address; "Receive ETH on Base Sepolia" |
| Pick USDC | the QR changes (token transfer URI); the title shows USDC |
| Copy address | toast "Copied"; paste it somewhere and compare with the screen |
| Scan the QR with another wallet | it shows your address, network and (for USDC) the token |

## 5. Send (needs a funded test account)

Fund the address from Receive with Base Sepolia ETH, and USDC if you want to test tokens. Pull down on Home to refresh balances.

| Step | Expected |
|---|---|
| Home -> Send, enter a bad address | "This is not a valid address on this network." |
| Enter a valid address you never paid | "You have not sent to this address before." |
| Enter an amount above the balance | "The balance is too low for this amount." |
| Max on ETH | amount = balance minus the quoted fee; Max on USDC = full balance |
| Valid address and amount | a fee line, "Network fee: up to …" |
| Confirm the payment | PIN or biometry prompt; cancelling sends nothing |
| After auth | "Payment sent", then "Payment complete" within seconds, with "View in explorer" opening the transaction on the block explorer |
| Send twice quickly | the second is blocked: "Wait until your previous payment is complete." |

## 6. History

| Step | Expected |
|---|---|
| Home -> History | newest first, status chip per payment (Pending, Complete, Failed), direction and short address |
| Incoming USDC from another account | shown as "From 0x…" |
| Note at the top | older payments and incoming ETH may be missing (logs-based history on this chain) |
| Pull down | list refreshes |

## 7. Settings, reveal, remove

| Step | Expected |
|---|---|
| Settings -> Default network | the chosen chain is remembered after a restart |
| Show recovery phrase | PIN or biometry first; then the words; hidden in the background; no copy button; no screenshot |
| Remove payment wallet | warning with balances; Cancel keeps it; confirm with PIN removes it and the Payments tab returns to "Create / Import". Credentials are untouched |

## 8. Lock and restart

| Step | Expected |
|---|---|
| Force-stop and reopen, enter the PIN | the Payments tab opens the same wallet, same address, balances load |
| Open the Payments tab on the PIN screen / lockout | no payment data; after unlock it loads again |

## 9. Payment links and scanner

Make a QR code (any generator) from an EIP-681 text, with your own test address:

-   native: `ethereum:<address>@84532?value=1000000000000000` (0.001 ETH)
-   token: `ethereum:0x036CbD53842c5426634e7929541eC2318f3dCF7e@84532/transfer?address=<address>&uint256=1000000` (1 USDC)

| Step | Expected |
|---|---|
| Scan tab, scan the native QR (flag on) | Payments opens Send with recipient and amount filled |
| Scan the token QR | USDC selected, amount 1 |
| QR with `@1` (Ethereum mainnet) or an unknown token contract | the "invalid QR code" error; nothing opens |
| Send -> Scan a QR code (in-app scanner) | a plain address or a request for this network fills the form; another network or token shows "This payment request is for another network or token." |
| Same QR with the flag off | the "invalid QR code" error as before the feature |
| DIDComm and OpenID QR codes (flag on) | unchanged: connection, credential offer, presentation request |

OS-level links (browser, `adb shell am start -d ethereum:…`) do not open the app: no `ethereum` scheme is registered.

## 10. Backup and restore (needs wallet backup on)

Needs `ENABLE_WALLET_BACKUP=true`, a passkey-capable phone and a second device or a reinstall.

| Step | Expected |
|---|---|
| Create a wallet, tap "Back up now" on the last screen | "Backup complete." (or "The backup failed…" with a retry from Settings) |
| Note the address on Home | |
| Restore the backup on a second device (wallet restore at first start) | the Payments tab opens the wallet without registration, same address and same addresses for the other accounts |

## Automated run

Maestro needs a build with the flag on. From `heka-wallet/`:

```
maestro test .maestro/crypto/crypto-register.yaml
maestro test .maestro/crypto/crypto-import.yaml
maestro test .maestro/crypto/crypto-receive.yaml
```

Each flow clears the app's data first (PIN `482916`). They cover flows 1, 2, 3 and 4. `crypto-send.yaml` (tag `crypto-onchain`, flow 5) runs on demand with a funded key in env `CRYPTO_IMPORT_KEY` from a local file. Existing flows (`.maestro/*.yaml`) must pass with the flag off.

Debug output of a failed run: `~/.maestro/tests/<timestamp>`. Secret screens (phrase, import) show a black screenshot by design; use `maestro hierarchy` to see their elements.

## Known gaps

-   Hedera testnet, EIP-7702 USDC gas and signing requests come with F05, F08 and F07; their screens appear only when an adapter reports the capability.
-   French and Portuguese strings were written by an agent: have a native speaker read them.
