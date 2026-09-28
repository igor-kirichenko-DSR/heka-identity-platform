# Keycloak realms

`docker-compose.dev.yml` starts Keycloak with `start-dev --import-realm`, which imports every file in this directory on every start. A realm that already exists in the Keycloak database is **not** overwritten; delete the `keycloak` container to re-import. Two realms are defined:

| File                        | Realm           | Purpose                                                                                                                                                                                            |
| --------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `realm-heka.json`           | `heka`          | The **OID4VP SSO demo**: identity provider `heka-sso` brokering to heka-sso-service, test relying party `heka-sso-web-ui`, login theme `heka`. Users are federated wallet holders.                       |
| `realm-heka-platform.json`  | `heka-platform` | The **OIDC provider for heka-identity-service** (platform-wide replacement of heka-auth-service; plan in [`docs/keycloak-replacement-for-auth-service.md`](../../docs/keycloak-replacement-for-auth-service.md)). Users are platform operators. |

They are deliberately separate realms. A realm is Keycloak's isolation boundary for users, sessions, roles and settings, and the two populations must not share them: the platform realm hands every new user the `Admin` role through a default group, which must not apply to users brokered from a wallet; a single realm would also share the SSO cookie, so a password login into the platform UI would open the demo RP without a credential presentation and vice versa; and registration, password policy, email handling, theme and token lifetimes are realm-wide. In a real deployment the `heka` realm stands in for a customer's IdP, while `heka-platform` is Heka's own.

Everything in these files is **dev configuration**: the client secrets, the `demo` user password and the bootstrap admin (`admin` / `admin`, set in the compose file) must be replaced in any real deployment.

## What the `heka-platform` realm contains

| Item                                | Purpose                                                                                                                                                                                                                                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client `heka-identity-service`      | Bearer-only resource server. Owns the client roles `Admin`, `OrgAdmin`, `OrgManager`, `OrgMember`, `Issuer`, `Verifier`, `User` and is the audience (`aud`) of accepted tokens. Never logs in.                                                                                                     |
| Client `heka-identity-web-ui`       | Public SPA client for heka-identity-service-web-ui: Authorization Code + PKCE (S256), refresh tokens, redirect URIs and web origins for `http://localhost:8000`.                                                                                                                                     |
| Client `heka-sso-service`           | Confidential client with a service account; heka-sso-service obtains its identity-service token with Client Credentials. Its service-account user holds the `Admin` role. Dev secret: `dev-only-heka-sso-service-secret-do-not-use-in-production`.                                               |
| Protocol mappers (on both clients)  | Add the identity-service claim contract to tokens: `roles` (client roles of `heka-identity-service`, array), `org_id` (user attribute), `heka_uid` (the Keycloak user id, a copy of `sub`), and `aud: heka-identity-service`. Kept on the clients rather than in a custom client scope, see below. |
| Group `heka-users` (default group)  | Carries `heka-identity-service.Admin`. Every new user (self-registration included) joins it, so they can use the web UI as an administrator of their own tenant, which is what heka-auth-service did. See [Roles](#roles) before assigning any other role.                                          |
| Realm settings                      | Self-registration on; password policy `length(7) and upperCase(1) and lowerCase(1) and digits(1) and specialChars(1)` (the heka-auth-service rules); refresh-token rotation (`revokeRefreshToken`); login theme `heka` (shared with the demo realm, it is a plain username/password page with Heka branding). |
| User `demo` / `Password1234!`       | Dev-only account with a fixed id (`d3a1c2b4-5e6f-4a7b-8c9d-0e1f2a3b4c5d`), matching the demo user the web UI's `prepare-demo-user` script used to create in heka-auth-service. Member of `heka-users`.                                                                                                  |

The display name comes from the built-in `profile` scope (`name`, or `preferred_username` when no first/last name is set), which heka-identity-service reads through its default `OIDC_CLAIM_NAME` fallback list. No custom mapper is needed for it.

Why no custom client scope and no default-role composite: with `--import-realm`, a `clientScopes` array in the file suppresses the creation of Keycloak's built-in scopes (`profile`, `email`, `basic`, …), and a `roles.realm` array suppresses the built-in realm roles (`offline_access`, `uma_authorization`), which then breaks the import. Mappers on the clients and a default group give the same tokens without touching either section.

The `heka-sso` relationship differs per realm: in `heka` the bridge is an **identity provider** that Keycloak brokers to; in `heka-platform` heka-sso-service is a **client** that obtains tokens for calling heka-identity-service. If the platform UI should ever offer "Sign in with wallet", add the `heka-sso` identity provider to `heka-platform` as well; that does not require sharing users between the realms.

## heka-identity-service settings

```
OIDC_ISSUER_URL=http://localhost:8080/realms/heka-platform
OIDC_AUDIENCE=heka-identity-service
```

The claim paths keep their defaults (`sub`, `roles`, `name,preferred_username,nickname`, `org_id`). When the identity service runs in a container, keep `OIDC_ISSUER_URL` at the browser-facing value and point `OIDC_JWKS_URI` at `http://host.docker.internal:8080/realms/heka-platform/protocol/openid-connect/certs` (see `heka-identity-service/docker-compose.dev.yml`).

`KC_HOSTNAME` is pinned to `http://localhost:8080` in `docker-compose.dev.yml`, so `iss` is the same string whether Keycloak is reached from the host or from a container. Change both `KC_HOSTNAME` and `OIDC_ISSUER_URL` together when deploying elsewhere.

## Roles

heka-identity-service derives the tenant from `(role, sub, org_id)` and requires **exactly one** Heka role per token. Because membership of `heka-users` grants `Admin`, a user who should hold another role must leave that group:

1. Users → the user → Groups → leave `heka-users`;
2. Role mapping → assign one client role of `heka-identity-service`;
3. for `OrgAdmin`, `OrgManager`, `OrgMember`, `Issuer`, `Verifier` set the user attribute `org_id` (Users → Attributes). `Admin` and `User` must **not** have `org_id`.

To stop handing out `Admin` by default, remove `/heka-users` from Realm settings → User registration → Default groups.

## Trying it out

Start Keycloak (the theme builder runs first and needs network access on the first run):

```sh
docker compose -f docker-compose.dev.yml up -d keycloak
```

Service-account token for heka-sso-service (Client Credentials):

```sh
curl -s -X POST http://localhost:8080/realms/heka-platform/protocol/openid-connect/token \
  -u heka-sso-service:dev-only-heka-sso-service-secret-do-not-use-in-production \
  -d grant_type=client_credentials
```

User token: sign in through the web UI (phase 5), or open an Authorization Code + PKCE request for `heka-identity-web-ui` in the browser and log in as `demo`:

```
http://localhost:8080/realms/heka-platform/protocol/openid-connect/auth?client_id=heka-identity-web-ui&response_type=code&scope=openid%20profile&redirect_uri=http%3A%2F%2Flocalhost%3A8000%2F&code_challenge=<S256 challenge>&code_challenge_method=S256
```

Decode the access token (e.g. `jwt.io`) and check `aud` is `heka-identity-service`, `roles` is `["Admin"]`, `heka_uid` equals `sub`, and `preferred_username` is set. Such a token is accepted by heka-identity-service configured as above; this was verified against Keycloak 26.3 with both a Client Credentials token and a `demo` user token obtained through the code flow.

## Admin console

`http://localhost:8080/admin/` with `admin` / `admin`; pick the realm (`heka` or `heka-platform`) in the top-left selector. Anything changed there is lost when the `keycloak` container is recreated unless it is exported back into the matching realm file.
