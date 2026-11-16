# Crypto signing requester

A small test relying party for the signing-request channel of the Heka Wallet payment module (`heka-sign`). It serves a signing request, receives the signature the wallet posts back and verifies it with viem. The request format is documented in `heka-wallet/docs/crypto_wallet/F07-binding-signing.md`.

> Demo code, not for production use: no authentication, no persistence, plain http.

## Run

```bash
yarn install
yarn start
```

It listens on `0.0.0.0:8787` (`PORT`). The address it tells the wallet to use comes from `REQUESTER_BASE_URL`:

| Wallet runs on                  | Set                                                 | Notes                                                                                                                            |
| ------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Android emulator                | nothing                                             | the default is `http://10.0.2.2:8787`, the host as seen from the emulator                                                        |
| Real device on the same network | `REQUESTER_BASE_URL=http://<host LAN address>:8787` | find the address with `ipconfig` (Windows) or `ifconfig` / `ip addr`; allow inbound connections on the port in the host firewall |
| Real device on another network  | `REQUESTER_BASE_URL=https://<tunnel host>`          | the debug build accepts plain http, a release build needs https                                                                  |

```bash
REQUESTER_BASE_URL=http://192.168.0.10:8787 yarn start    # bash; the address is an example, use your own
$env:REQUESTER_BASE_URL = 'http://192.168.0.10:8787'; yarn start   # PowerShell
```

The Maestro flow needs the same address in `REQUESTER_APP_URL` and has no default: `maestro test -e REQUESTER_APP_URL=http://<host LAN address>:8787 .maestro/crypto/crypto-sign-request.yaml` (an emulator: `http://10.0.2.2:8787`).

Plain `http` is accepted by the wallet only in a debug build. A release build needs `https` (put the requester behind a tunnel).

On start it prints one `heka-sign://` link per kind (`eip712`, `siwe`, `personal_sign`, branch `binding`) and a QR code for the SIWE one. Scan a QR code in the wallet's scanner, or open a link on the device.

## Make your own request

A request is created the first time its URL is read:

```
GET /requests/<id>?kind=personal_sign|eip712|siwe&branch=payment|binding&chain=eip155:84532
```

Wrap that URL in a link: `heka-sign://?request_uri=<url-encoded URL>`.

## Read the result

```
GET /requests/<id>/result    ->  { "status": "pending" | "verified" | "invalid", "address": "0x..." }
```

`verified` means viem recovered the posted address from the signature for the exact message this server asked to sign (`verifyMessage`, `verifyTypedData`, and for SIWE `validateSiweMessage` plus `verifyMessage`).

## Test

```bash
yarn test
```

The Maestro flow `heka-wallet/.maestro/crypto/crypto-sign-request.yaml` uses this server.
