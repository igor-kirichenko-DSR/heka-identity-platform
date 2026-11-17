# Crypto wallet: how to run each feature

Short guides for a developer with a debug build. Test networks only: never use a key that holds real funds. Keep test keys in a local, untracked file, never in the repo, `app/.env.example` or a chat. Step-by-step checks with expected results: `docs/crypto_wallet/manual-check.md`.

## Accounts and faucets at a glance

| Feature | Account needed | Funds needed | Where |
|---|---|---|---|
| Payments (Base Sepolia) | none | Base Sepolia ETH, optionally test USDC | ETH: the faucets listed on `docs.base.org/chain/network-faucets` (the Coinbase CDP faucet is the first; its docs are at `docs.cdp.coinbase.com/faucets`). USDC: Circle faucet `faucet.circle.com` (pick Base Sepolia, paste the address from Receive) |
| Payments (Hedera testnet) | none | HBAR; optionally test USDC | HBAR: Hedera portal faucet `portal.hedera.com` (free portal login), sent to the wallet's EVM address. USDC: Circle faucet, but it wants the `0.0.x` account id, not the EVM address, and the account must already exist (look it up at `https://testnet.mirrornode.hedera.com/api/v1/accounts/<evm address>`) |
| Signing requests (SIWE, EIP-712, nonce) | none | none | local requester in `demo/crypto-sign-requester` |
| Fees in USDC (paymaster) | none for the public bundler; Pimlico account for a keyed bundler URL | an account with USDC and **zero ETH** | USDC: Circle faucet. Bundler key: `dashboard.pimlico.io` |

The Circle Paymaster itself needs no Circle account and no key: it is a public contract. The Circle account question only concerns the faucet.

## 1. Run the wallet with the crypto module

Mandatory in `app/.env`:

| Variable | Value |
|---|---|
| `ENABLE_CRYPTO_MODULE` | `true` |

Everything else under `CRYPTO_*` is optional; empty uses the built-in public endpoints.

1.  In `heka-wallet/app`, copy `.env.example` to `.env` and set the flag. Values stay on one line.
2.  Start Metro and a debug build on an Android phone or emulator: `yarn run:android` from `heka-wallet/`. A changed `.env` needs this rebuild, not a Metro reload.
3.  Open the app, enter the PIN, open the **Payments** tab, create a wallet (write the 12 words, repeat them) or import a test key.
4.  Fund it: Home -> Receive shows the address. Send Base Sepolia ETH (and USDC) to it from the faucets above. Pull down on Home to refresh.
5.  Home -> Send to try a payment.

Optional values: `CRYPTO_DEFAULT_CHAIN` (`eip155:84532` Base Sepolia, `eip155:296` Hedera testnet), `CRYPTO_RPC_URL_BASE_SEPOLIA`, `CRYPTO_RPC_URL_HEDERA_TESTNET`. An override must be `https://`.

## 2. Hedera testnet

Same flag as above, no extra variable. In Settings -> Default network pick Hedera testnet (or set `CRYPTO_DEFAULT_CHAIN=eip155:296`).

1.  The address is the same as on Base Sepolia. Fund it with HBAR from the portal faucet, sent to that EVM address. The first send completes the account.
2.  USDC on Hedera needs the token associated; test it only if you have `0.0.429274` USDC from the Circle faucet.
3.  Public Hashio RPC is for development only; set `CRYPTO_RPC_URL_HEDERA_TESTNET` to a keyed relay if it throttles.

Fees on Hedera are always paid in HBAR: EIP-7702 is not active there, so there is no USDC fee mode.

## 3. Signing requests (SIWE, EIP-712, nonce)

Needs section 1 running and a wallet created. No extra wallet variable.

1.  In `demo/crypto-sign-requester`: `yarn install`, then `yarn start`. It listens on port 8787 and prints one `heka-sign://` link per kind (and a QR for SIWE).
2.  Set `REQUESTER_BASE_URL` to the address the phone reaches the host at:

    | Wallet runs on | Set |
    |---|---|
    | Android emulator | nothing (default `http://10.0.2.2:8787`) |
    | Real device, same network | `REQUESTER_BASE_URL=http://<host LAN address>:8787`, and allow the port in the host firewall |
    | Real device, other network | `REQUESTER_BASE_URL=https://<tunnel host>` (for example an ngrok tunnel) |

3.  In the wallet open the scanner (Scan tab) and scan the QR in the terminal, or open a printed link on the device.
4.  The wallet shows the requester, chain, signing address and the decoded content. Press Sign, confirm with PIN.
5.  Check the result: `GET <base url>/requests/<id>/result` returns `verified`.

Plain `http` is accepted only in a debug build; a release build needs `https`. No funds are needed: signing costs nothing.

## 4. Fees in USDC (Circle Paymaster)

Base Sepolia only. Needs section 1.

Variables:

| Variable | Required | Meaning |
|---|---|---|
| `ENABLE_CRYPTO_MODULE` | yes | `true` |
| `CRYPTO_USDC_FEES` | no | empty or `true` offers USDC fees; `false` hides them |
| `CRYPTO_BUNDLER_URL_BASE_SEPOLIA` | no, but recommended | a keyed bundler URL; empty uses the public Pimlico bundler, which is rate-limited |

Steps:

1.  Optional but recommended: create a Pimlico account at `dashboard.pimlico.io`, create an API key, set `CRYPTO_BUNDLER_URL_BASE_SEPOLIA=https://api.pimlico.io/v2/84532/rpc?apikey=<your key>` in `app/.env`. Treat the key as a secret: it must not be committed. If it ends up in a log or a chat, rotate it.
2.  Rebuild: `yarn run:android`.
3.  Use a **fresh** account with USDC and no ETH: import a new test key, then send at least 0.05 USDC to it from the Circle faucet (Base Sepolia). Do not send ETH.
4.  Home -> Send, enter a valid address and a USDC amount. The fee choice appears: native asset or "Pay fee in USDC". Choose USDC and confirm with the PIN.
5.  Expected: "Payment sent", then "Payment complete"; the explorer link opens the bundler transaction; History shows one row. The first such send also upgrades the account in place with EIP-7702 (the address does not change).

If the bundler is unreachable the wallet asks "Pay the network fee in ETH instead?" and sends nothing until you answer. An account delegated to another contract cannot pay in USDC.

## 5. Integration tests against the live testnets (optional)

Not run by default. Copy `.env.crypto-test-keys.example` to `.env.crypto-test-keys` (gitignored; not `app/.env`, which is compiled into the build) and fill what you need, then run the specs with `CRYPTO_IT=1`:

| Variable | For | Account state |
|---|---|---|
| `CRYPTO_IT_PRIVATE_KEY` | Base Sepolia | ETH and at least 0.01 USDC |
| `CRYPTO_IT_ZERO_ETH_KEY` | USDC fees | at least 0.05 USDC, zero ETH |
| `CRYPTO_IT_BUNDLER_URL` | USDC fees | optional keyed bundler URL |
| `CRYPTO_IT_HEDERA_KEY` | Hedera | at least 5 HBAR |

Generate a key with any wallet and fund it from the faucets above; do not reuse a personal key.
