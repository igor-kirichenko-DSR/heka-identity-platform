# F07 — Binding signatures and the signing-request channel

-   **Phase:** 1 (signer), 2 (request channel and screen)
-   **Depends on:** F02, F03
-   **Gate:** none
-   **Design:** §2.5 step 3, §2.8 F7, §2.9

## Goal

Let a relying party ask the holder to sign an EIP-712 typed-data message, a SIWE (EIP-4361) message or a plain nonce (EIP-191) with the payment account or the binding branch, and show the holder exactly what they sign before any key is touched.

Without a request channel F7 has no caller in the MVP (WalletConnect is stretch), so the channel is part of this sub-feature.

## Scope

-   In: signer helper; signing-request format; fetch, validate and render the request; confirm-before-sign; post the response.
-   Out: WalletConnect (F09); `eth_sendTransaction` requests from a relying party (payments go through Send or F12).

## Signing-request format (proposal — agree before implementation)

QR or deep link: `heka-sign://?request_uri=<https URL>`. The wallet GETs the URL and receives JSON:

```json
{
  "version": 1,
  "id": "opaque request id",
  "kind": "eip712" | "siwe" | "personal_sign",
  "chain": "eip155:84532",
  "branch": "payment" | "binding",
  "payload": { "...": "typed data, SIWE fields or the message" },
  "response_uri": "https://… (same origin as request_uri)",
  "expires_at": "ISO 8601"
}
```

The wallet POSTs `{ id, address, signature }` to `response_uri`. Only `https` is accepted (plain `http` only in `__DEV__`); `response_uri` must have the same origin as `request_uri`; an expired request is refused.

## Components

### Wallet — `packages/crypto/evm`

-   `src/signing.ts`: `signTypedData`, `signSiwe` (build with viem's SIWE helpers and sign with `signMessage`), `signNonce` (EIP-191); each inside `KeyProvider.withAccount(branch, 0, …)`.
-   Validation: typed-data `domain.chainId` must equal the request's chain; SIWE `domain` must equal the `request_uri` host and `chainId` must match; refuse typed data whose primary type is `Permit` / `Permit2` or whose domain is a token contract in the registry unless the request is from the wallet itself (blocks a binding request from becoming an allowance).

### Wallet — `packages/crypto/core`

-   `src/requests/SigningRequest.ts`: URI parse, fetch with timeout, schema validation, origin checks.
-   Ledger: signed requests recorded locally (id, origin, kind, time) for the holder's own audit.

### Wallet — `packages/crypto/ui`

-   `src/screens/SignRequest.tsx`: shows the requester origin, the chain, the signing address and branch, and the decoded content (typed-data fields as a tree; SIWE statement and URI; the nonce as text); "Sign" requires PIN / biometry; "Reject" posts nothing.
-   Signed requests from the ledger shown in History under a "Signatures" filter or in Settings.

### Wallet — `app`

-   Scanner / deep-link routing to SignRequest (F06).

### Identity Service

No change for wallet-attested binding. An issuer-attested address claim is a separate option (F14 decision): it would need an issuance template carrying a CAIP-10 address claim and an issuer-side SIWE check, i.e. Identity Service work tracked in F14.

### Demo

-   A minimal test requester used by tests and demos: a small Node script or route in the demo project (decided in F14) that creates a request, serves it, receives the signature and verifies it with viem `verifyTypedData` / `verifySiweMessage` / `verifyMessage`.

## Tests

-   Unit: request schema and origin checks; expired and cross-origin rejection; chain mismatch rejection; permit-shaped typed data rejection; signatures verify with viem verify functions for both branches.
-   Component: SignRequest renders each kind; Sign disabled until auth.
-   Maestro: scan a signing-request QR served by the test requester (local), sign, requester reports a valid signature.

## Specs and docs

-   `specs/wallet/30-Features/`: new page for signing requests (format, checks, screens).
-   The request format, once agreed, documented once (this file or a spec) and referenced by F14.

## Acceptance criteria

-   A relying party can obtain an EIP-712, SIWE or nonce signature from the holder's payment or binding address, verified on its side.
-   The holder always sees origin, chain, address and content before signing; nothing is signed without fresh auth.
-   A permit or allowance cannot be obtained through a binding request.

## Open questions

-   Format: own `heka-sign` scheme (simple, demo-ready) vs waiting for WalletConnect (standard, larger). Recommendation: own scheme now; F09 later reuses the same screen.
-   Binding branch per integration: recorded in F14.
