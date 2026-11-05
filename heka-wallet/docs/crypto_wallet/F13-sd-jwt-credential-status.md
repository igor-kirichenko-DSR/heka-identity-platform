# F13 — Credential status on SD-JWT VCs (Token Status List)

-   **Phase:** 3 — can start at any time; no wallet dependency
-   **Depends on:** nothing in this plan; aligns with issue #217
-   **Gate:** none
-   **Design:** §1 use cases 1 and 3 ("revocation freezes the rail"), §2.9 "Credential status"

## Goal

SD-JWT VCs issued by the Identity Service carry a `status` claim pointing at an IETF Token Status List, the issuer can revoke them, and a verifier rejects a revoked credential at presentation time. Without this, the revocation scenarios cannot be shown with SD-JWT VCs.

## Current state (checked in code)

-   `src/openid4vc/issuance-sessions/issuance-session.service.ts`: a W3C Bitstring Status List entry (`credentialStatus { location, index }`) is attached only to `jwt_vc_json`, `jwt_vc_json-ld` and `ldp_vc`; the comment says "sd+jwt and mso_mdoc do not support revocation".
-   `src/common/entities/credential-status-list.entity.ts`: `CredentialStatusList` (bitstring, `size`, `lastIndex`, `purpose`, `owner`); `src/revocation/status-list/` has the service and a public controller.
-   Revoke (`issuance-session.service.ts`, around line 213) reads `credential.credentialStatus.location`, which SD-JWT credentials do not have.
-   Credo 0.7.0's `SdJwtVcService` already fetches status lists when verifying an SD-JWT VC (`getStatusListFetcher`); `@sd-jwt/jwt-status-list` 0.19.0 is installed (as a transitive dependency).

## Components

### Identity Service

-   **Status list format.** Token Status List (draft-ietf-oauth-status-list): a JWT of type `statuslist+jwt` with `status_list: { bits: 1, lst: <zlib + base64url> }`, `sub` = the list URI, `iat`, `exp` / `ttl`, signed by the issuer's key (the same DID / key the SD-JWT VC is signed with).
-   **Entity.** Either a `format` column on `CredentialStatusList` (`'bitstring' | 'token-status-list'`) or a separate entity. Recommendation: a column, so allocation (`lastIndex`, capacity guard) and owner scoping are reused. → new migration (`db-migration` skill); do not edit applied migrations.
-   **Allocation at issuance.** In `issuance-session.service.ts`, for `vc+sd-jwt`: allocate an index from a token-status-list list (`getOrCreate` by issuer and format), add `status: { status_list: { idx, uri } }` to the SD-JWT payload, store `{ uri, idx }` with the issued credential record so revoke can find it. mdoc stays without status.
-   **Publishing.** `src/revocation/status-list/status-list.public.controller.ts`: a public `GET` for a token-status-list list returning `application/statuslist+jwt`, signed on request (or cached and re-signed on change) with an `exp` short enough for the demo (for example 5 minutes) and `Cache-Control` to match.
-   **Revoke.** The revoke path resolves an SD-JWT credential to its `{ uri, idx }` and flips the bit; the same API as for W3C credentials; 4xx for mdoc.
-   **Dependency.** Add `@sd-jwt/jwt-status-list` as a direct dependency at an exact version (today it is only transitive) or use Credo's helpers if exposed.
-   **Verifier.** Confirm that verification sessions reject a revoked SD-JWT VC (Credo fetches the list); expose the reason in the session result.
-   Swagger for the new public endpoint; no change to request DTOs unless the status format must be chosen per issuance.

### Wallet — `app`

-   Optional: show a "Revoked" state for SD-JWT VCs, if the wallet already shows revocation for W3C credentials (check `app/src/contexts/SdJwtCredentials.tsx` and credential display); otherwise leave for later. The holder learns about revocation at the next presentation either way.

### Wallet — crypto packages

No change.

### Identity Service web UI

-   If the UI offers "revoke" only for W3C credentials, enable it for SD-JWT VCs too (check the credential list page); otherwise no change.

### Demo

-   F14 revocation scenarios depend on this.

## Tests

-   Unit (`src/openid4vc/issuance-sessions/__tests__/issuance-session.service.test.ts`, `src/revocation/status-list/__tests__/`): SD-JWT offer gets a `status` claim with the next index; capacity guard; token encoding round trip with `@sd-jwt/jwt-status-list`.
-   E2E (`test/revocation.e2e.test.ts`, `test/openid4vc-issuance-session.test.ts`, `test/openid4vc-verification-session.test.ts`): issue an SD-JWT VC to the test holder → present → verified; revoke → the public list shows the bit set → present again → rejected with a status reason. Regression: W3C bitstring revocation unchanged.

## Specs and docs

-   `specs/identity-service/`: revocation / status list page (both formats), issuance page (status claim for SD-JWT), public endpoint.

## Acceptance criteria

-   Every newly issued SD-JWT VC has a status claim; the list URI is publicly reachable and signed.
-   Revoking an SD-JWT VC makes the next presentation fail verification.
-   W3C credential revocation behaves exactly as before.

## Open questions

-   Scope against #217: this file may be superseded by #217's own plan; align before starting.
-   Suspension (`purpose: suspension`) for SD-JWT: out of v1 unless a scenario needs "freeze and unfreeze".
