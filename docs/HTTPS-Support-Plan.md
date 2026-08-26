# HTTPS Support Plan

Plan for enabling HTTPS across the five services of the Heka identity platform:

| Service | Stack | Port(s) today | TLS today |
|---|---|---|---|
| heka-auth-service | NestJS 11 (Express) | 3004 | none |
| heka-identity-service | NestJS + Credo agent | 3000 (REST), 3001 (DIDComm HTTP), 3002 (DIDComm WS), 3003 (OID4VC) | none |
| heka-identity-service-web-ui | React 18 + Webpack 5 dev server | 8000 (dev) / static `build/` (prod) | none |
| heka-sso-service | NestJS 11 + node-oidc-provider (embedded login UI in `ui/`) | 3005 | none (but `provider.proxy = true` already set) |
| heka-sso-web-ui | React 19 + Vite (demo RP behind Keycloak) | 5173 (dev) / static `dist/` (prod) | none |

No service currently creates an HTTPS server, loads a certificate, or sets a
`secure` cookie flag explicitly. All inter-service URLs are `http://localhost:*`
in `.env` files, docker-compose env blocks, and the Keycloak realm import.

**Out of scope (explicit decisions):**

- `demo/` (`a2a-oid4vp`) keeps its hardcoded `http://` endpoints — not migrated.
- `heka-wallet` on-device testing: mkcert certificates are not trusted on
  mobile devices. Installing the CA on test devices (or keeping the existing
  ngrok flow from
  `heka-identity-service/docs/local-config-for-heka-wallet-integration.md`)
  is left outside this plan.

---

## 1. Chosen approach: TLS termination at a reverse proxy

Two options were considered:

**(a) Native TLS in every service** — pass `httpsOptions` (cert/key) to
`NestFactory.create()` in each Nest service, add `server: 'https'` to the two
dev servers, and distribute certificates to five processes.

**(b) A single TLS-terminating reverse proxy (nginx)** in front of all plain-HTTP
services, with services trusting `X-Forwarded-*` headers.

**Decision: (b), reverse proxy**, because the codebase already assumes it:

- `heka-sso-service/src/oidc/provider.factory.ts:248-249` already sets
  `provider.proxy = true` with the comment "TLS terminates at the reverse proxy".
- `heka-sso-service/docs/THREAT-MODEL.md` (deployment checklist) and
  `docs/INTEGRATION.md` §37/§288 document "TLS offload + https issuer" as the
  production deployment model.
- `heka-identity-service/docs/local-config-for-heka-wallet-integration.md:24-66`
  already contains a working nginx fan-out config for the four identity-service
  ports plus auth-service — it only lacks TLS and existence as a real compose service.
- Native TLS would conflict with the existing `provider.proxy = true` and would
  require cert distribution into five processes instead of one.

Native TLS remains available as an opt-in for the two Nest services (see §3.6,
`APP_USE_HTTPS`) for environments where a proxy is not possible, but it is not
the primary path.

### Target topology

```
                          ┌────────────────────────────────────────────┐
  https://…  ──► nginx ───┤  /            → heka-sso-web-ui static     │
  (TLS, :443)             │  /sso/        → heka-sso-service :3005     │
                          │  /idw/        → identity-service-web-ui    │
                          │  /api/        → heka-identity-service :3000│
                          │  /agent-http  → identity-service :3001     │
                          │  /agent-ws    → identity-service :3002 (WS)│
                          │  /openid/     → identity-service :3003     │
                          │  /auth/       → heka-auth-service :3004    │
                          └────────────────────────────────────────────┘
```

(Path prefixes vs. per-service hostnames — e.g. `sso.example.com`,
`id.example.com` — is a deployment choice; the nginx config supports either.
For local dev a single hostname with path prefixes is simplest. **Exception:**
`node-oidc-provider` is mounted at the sso-service app root and derives
discovery URLs from the forwarded `Host` header, so the sso-service is cleanest
on its **own hostname** rather than a path prefix.)

### Certificates

- **Local dev:** [mkcert](https://github.com/FiloSottile/mkcert) — generates a
  locally-trusted CA and per-hostname certs with zero browser warnings. Certs
  mounted into the nginx container. Document `mkcert -install` +
  `mkcert localhost 127.0.0.1 ::1 <hostnames>` in a new `docs/https-local-dev.md`.
- **Production:** operator-provided certs or Let's Encrypt/certbot on the proxy.
  Out of scope for code changes; documented only.

---

## 2. Cross-cutting work items

### 2.1 Root-level HTTPS compose — single-command startup

Create a **root-level `docker-compose.https.yml`** (repo root) that is used
**exclusively for serving the platform over HTTPS**. It brings the whole stack
up with one command:

```
docker compose -f docker-compose.https.yml up
```

The per-service compose files stay untouched and remain the plain-HTTP
standalone dev workflow; the root file does not replace them.

Contents of the root compose:

1. **All services defined flat in the root file**, mirroring the per-service
   compose files. (`include:` was the original intent, but all three
   per-service files define a service named `postgres`; Compose merges included
   files into a single project where duplicate service names are a hard error,
   so reuse-by-include is not possible without renaming services in the
   per-service files — which stay untouched. The Postgres services are
   disambiguated in the root file as `auth-postgres` / `identity-postgres` /
   `sso-postgres`.) Keycloak is lifted from
   `heka-sso-service/docker-compose.dev.yml`; the sso env mirrors the dev
   variant (the Keycloak demo needs `OIDC_CLIENTS` + stub login), with
   `IDENTITY_SERVICE_BASE_URL` pointed at the in-network service name per §2.4.
2. **One project network** — since everything is a single flat project, the
   default network already lets nginx resolve backends by compose service
   name (`heka-auth-service:3004`, `heka-identity-service:3000`,
   `heka-sso-service:3005`, …).
3. **The `nginx:alpine` TLS terminator**, listening on `443` (and `80` →
   redirect to `443`), volume-mounting `deploy/nginx.conf` and the mkcert
   cert/key pair.
4. **Both web UIs** as static-serving containers (Dockerfiles from Phase 4) —
   or, until those exist, their `build/` / `dist/` output mounted into nginx.
5. **Host port overrides:** only nginx publishes `443`/`80`; the root file
   overrides the included services' `ports:` mappings away (or narrows them)
   so backends are reachable only through the proxy.
6. **Network aliases on the nginx service** for every public hostname
   (e.g. `sso.localhost`), so containers inside the compose network resolve
   the public https URLs to the proxy (needed for Keycloak's backchannel
   calls — see §2.6).

nginx location blocks follow the topology above, based on the recipe in
`heka-identity-service/docs/local-config-for-heka-wallet-integration.md`.

- **Must-haves in every location block:**
  - `proxy_set_header Host $host;` — sso-service discovery URLs are derived from
    the forwarded Host (`heka-sso-service/docs/INTEGRATION.md:288`).
  - `proxy_set_header X-Forwarded-Proto $scheme;` and `X-Forwarded-For`.
  - WebSocket upgrade headers (`Upgrade`/`Connection`) on `/agent-ws`
    (DIDComm WS, port 3002) and on the sso-service location (future
    `/interaction/*/events` push, `INTEGRATION.md:350`).
- **Prefix rewriting** — spell out per location whether the prefix is stripped:
  - `/auth/` strips to `/` — auth-service already serves under its own
    `APP_PREFIX=api` (`heka-auth-service/src/core/config/configs/app.config.ts:19`),
    so `https://<host>/auth/api/v1/…` → `http://heka-auth-service:3004/api/v1/…`.
  - `/idw/` strips to `/` for the static identity-web-ui files (and the build
    must use a matching `publicPath` — see §3.3.3).
  - `/openid/` — verify how Credo's OID4VC express app prefixes its routes and
    make the location's rewrite (or pass-through) match the path advertised in
    `AGENT_OID4VCI_ENDPOINT`.
- **Hardening & limits:** `Strict-Transport-Security` header on https
  responses; `client_max_body_size` and proxy read timeouts sized for
  credential-exchange payloads.
- **Dev port fallback:** if `443` is privileged or occupied on a dev machine,
  document `8443` as the alternative (all public URLs then carry the port).

### 2.2 Environment variables: switch schemes

All of these move from `http://` to `https://` (values shown are the local-dev
targets; production substitutes real hostnames):

| File | Variable | New value |
|---|---|---|
| `heka-sso-service/env/.env(.example)` | `OIDC_ISSUER_URL` | `https://sso.localhost` (or chosen host) |
| `heka-sso-service/env/.env(.example)` | `IDENTITY_SERVICE_BASE_URL` | stays internal — see §2.4 |
| `heka-sso-service/env/.env(.example)` | `AUTH_SERVICE_BASE_URL` | stays internal — see §2.4 |
| `heka-sso-service/env/.env(.example)` | `OIDC_CLIENTS` redirect/logout URIs | `https://` Keycloak URLs |
| `heka-identity-service` compose env | `AGENT_HTTP_ENDPOINT` | `https://<host>/agent-http` |
| `heka-identity-service` compose env | `AGENT_WS_ENDPOINT` | `wss://<host>/agent-ws` |
| `heka-identity-service` compose env | `AGENT_OID4VCI_ENDPOINT` | `https://<host>/openid` |
| `heka-identity-service` compose env | `APP_ENDPOINT` | `https://<host>/api` |
| `heka-identity-service-web-ui/.env(.example)` | `REACT_APP_AGENCY_ENDPOINT` | `https://<host>/api` |
| `heka-identity-service-web-ui/.env(.example)` | `REACT_APP_AUTH_SERVICE_ENDPOINT` | `https://<host>/auth` |
| `heka-sso-web-ui/.env(.example)` | `VITE_KC_URL` | `https://<keycloak-host>` |

Note the URL validator in
`heka-sso-service/src/core/config/configs/oidc.config.ts:94` already accepts
both `http` and `https`, so no validation changes are needed.

### 2.3 Build-time URL baking (both web UIs)

`REACT_APP_*` vars are baked into the identity-web-ui bundle at webpack build
time (`config/build/buildPlugins.ts:33`, dotenv-webpack) and `VITE_*` vars at
vite build time. **Switching to https therefore requires a rebuild, not just an
env change.** The plan accepts this for now; add a note to both READMEs. (A
runtime-config mechanism — e.g. a served `config.json` — is a possible follow-up
but out of scope.)

### 2.4 Internal (service-to-service) traffic stays HTTP

Server-side calls that never leave the Docker network keep plain HTTP against
container-internal addresses:

- sso-service → auth-service (`identity-service-token.provider.ts:62`)
- sso-service → identity-service (`verification-session.client.ts:213`)

So `AUTH_SERVICE_BASE_URL` / `IDENTITY_SERVICE_BASE_URL` point at
`http://<compose-service-name>:<port>` rather than the public https origin.
Only **browser-facing and wallet-facing** URLs (issuer, agent endpoints,
redirect URIs, web-UI API endpoints) must be https. This avoids double
encryption and cert distribution inside the compose network. (If a deployment
requires encrypted east-west traffic, the native-TLS option in §3.6 covers it.)

### 2.5 CORS tightening (do together with the scheme switch)

Both Nest services parse `APP_ALLOW_ORIGINS` but never apply it — `origin` is
commented out in `heka-auth-service/src/main.module.ts:80` and
`heka-sso-service/src/main.module.ts:94`; identity-service defaults to
`origin: '*'` (`src/config/express.ts:5`). While updating origins to `https://`
values, wire `config.allowedOrigins` into `enableCors()` in both services and
set `EXPRESS_CORS_OPTIONS` for identity-service.

### 2.6 Public https URLs called from inside containers (DNS + CA trust)

Some server-to-server calls target the **public** https URLs rather than
internal http addresses — most importantly Keycloak's broker backchannel
(`tokenUrl`, `jwksUrl`, `userInfoUrl` in the realm import) hitting the sso
issuer. Two prerequisites for any such caller:

1. **DNS:** the public hostnames must resolve to nginx inside the compose
   network — covered by the network aliases on the nginx service (§2.1.6).
2. **CA trust:** the calling container must trust the mkcert root CA.
   - **Keycloak:** mount the mkcert `rootCA.pem` into the container and
     register it via `KC_TRUSTSTORE_PATHS` (Keycloak ≥ 24 accepts PEM paths
     directly).
   - **Node services** (e.g. sso-service, if its backchannel-logout calls to
     `OIDC_CLIENTS` URIs use public https URLs): set
     `NODE_EXTRA_CA_CERTS=/certs/rootCA.pem` in the container env.

**Decision:** the realm's backchannel URLs move to the https issuer just like
the browser-facing ones — no http/https split — so the `issuer` claim matches
everywhere and Keycloak validates tokens against a single issuer value.

---

## 3. Per-service work items

### 3.1 heka-auth-service

1. **Trust the proxy:** in `src/main.module.ts` bootstrap, add
   `app.set('trust proxy', true)` (guarded by a config flag, e.g.
   `APP_TRUST_PROXY`) so `req.protocol`, rate-limit keys, and logs reflect the
   real client.
2. **Wire the dead config hook:** `APP_USE_HTTPS` is declared in the config-key
   enum (`src/core/config/configs/app.config.ts:11`) but has no field,
   assignment, or consumer. Add the `useHttps` field and use it to:
   - toggle native TLS (§3.6) when set, and
   - assert https-only behavior (e.g. refuse to start with `secure`-sensitive
     settings misconfigured) in production mode.
3. **Compose healthcheck:** `docker-compose.yml:35` hardcodes
   `http://localhost:3004/health` — keep as-is (container-internal), but verify
   after changes.
4. No cookies are issued (JWT bearer only) — no `secure`-flag work.
5. Update CORS per §2.5.

### 3.2 heka-identity-service

The hot spot: this service **advertises its endpoints externally** (OOB
invitations, DID documents, OID4VCI issuer metadata), and wallets require
`https`/`wss` in production.

1. **Endpoint env vars** (`AGENT_HTTP_ENDPOINT`, `AGENT_WS_ENDPOINT`,
   `AGENT_OID4VCI_ENDPOINT`, `APP_ENDPOINT`) set to the proxy's public https
   URLs per §2.2. The code fallbacks in `src/config/express.ts:14` and
   `src/config/agent.ts:64-66` hardcode `http://`/`ws://` — acceptable as dev
   defaults, but log a startup **warning when an `http://` endpoint is
   advertised outside localhost**.
2. **Make `allowInsecureHttpUrls` conditional:** `src/config/agent.ts:99` sets
   `allowInsecureHttpUrls: true` unconditionally. Drive it from an env var
   (e.g. `AGENT_ALLOW_INSECURE_HTTP=true` only for local dev); default `false`
   when endpoints are https.
3. **All four listeners stay plain HTTP behind the proxy** — REST (3000),
   DIDComm HTTP (3001), DIDComm WS (3002), OID4VC express app (3003). The proxy
   fans out to them; the WS location needs upgrade headers (§2.1).
4. **Bind host:** `EXPRESS_HOST` defaults to `localhost`; in compose it must
   bind so the nginx container can reach it (already handled by compose
   networking — verify).
5. Once behind the proxy, stop publishing 3000–3003 to the host in the root
   https compose (only nginx exposes ports — §2.1.5).
6. Update healthcheck note: `docker-compose.dev.yml:33` uses container-internal
   `http://localhost:3000/health` — unchanged.
7. Note: `MDL_ISSUER_CERTIFICATE` (`agent.ts:121-128`) is an mDL
   document-signing certificate, **not** transport TLS — do not touch.

### 3.3 heka-identity-service-web-ui

1. **Dev over https: use the dev server's native TLS.** Add to
   `config/build/buildDevServer.ts` a conditional
   `server: { type: 'https', options: { key, cert } }` block driven by env vars
   (`HTTPS=true`, `SSL_KEY_FILE`, `SSL_CRT_FILE` — mkcert output). Default
   remains plain HTTP. Proxying the host-side dev server through the
   containerized nginx is deliberately **not** the dev path — it would need
   `host.docker.internal`/host-gateway plumbing and HMR `client.webSocketURL`
   configuration; the root https compose serves **built output only**.
2. **Prod serving:** the webpack build outputs static `build/` with no server.
   Serve it from the nginx container (mount or COPY `build/` into a static
   location block). Add a `Dockerfile` (multi-stage: node build → nginx static)
   so it can join compose like the backends. **`publicPath` must match the
   serving location**: the build currently hardcodes `publicPath: '/'`
   (`config/build/buildWebpackConfig.ts:21`), which breaks every asset URL if
   served under `/idw/` — make it env-driven (e.g. `--env publicPath=/idw/`)
   or serve the UI on its own hostname at `/`.
3. **Env:** `.env(.example)` endpoints to https per §2.2; document the rebuild
   requirement (§2.3). Also fix `scripts/prepare-demo-user.ts:8,10` fallbacks
   to respect the env scheme.
4. Tokens live in `localStorage` — no cookie work. (Moving them is a separate
   security task, out of scope here.)

### 3.4 heka-sso-service

Most of the groundwork already exists; this is mostly configuration.

1. **`OIDC_ISSUER_URL` → https.** `node-oidc-provider` derives the `Secure`
   cookie attribute from the issuer scheme, so secure cookies materialize
   automatically — this closes the documented gap in `docs/THREAT-MODEL.md:74`.
2. **`provider.proxy = true` is already set** (`src/oidc/provider.factory.ts:248`).
   Additionally set Express-level `app.set('trust proxy', true)` in
   `src/main.module.ts` bootstrap for the non-provider routes (`/health`,
   `/interaction`, API prefix) — same `APP_TRUST_PROXY` flag as auth-service.
3. **Own hostname on the proxy:** because the provider is mounted at the app
   root and discovery URLs derive from the forwarded `Host`, give sso-service a
   dedicated server block (e.g. `sso.localhost`) with `proxy_set_header Host`
   preserved, rather than a path prefix.
4. **Keycloak realm import** (`keycloak/realm-heka.json`): update the six
   hardcoded broker URLs at lines 91–96 (`authorizationUrl`, `tokenUrl`,
   `jwksUrl`, `userInfoUrl`, `logoutUrl`, `issuer`) from
   `http://localhost:3005` / `http://host.docker.internal:3005` to the https
   issuer, and the RP entries at lines 38–42 (`redirectUris`, `webOrigins`,
   `post.logout.redirect.uris`) from `http://localhost:5173` to the https
   web-ui origin. Consider templating these via realm-import env substitution
   instead of hardcoding. All six broker URLs go to the https issuer —
   browser-facing and backchannel alike — which requires the mkcert CA in
   Keycloak's truststore and hostname resolution to nginx, per §2.6.
5. **Keycloak itself behind TLS:** in `docker-compose.dev.yml` either put
   Keycloak behind the same nginx (`/kc/` or `kc.localhost` +
   `KC_PROXY_HEADERS=xforwarded`, `KC_HOSTNAME=<https url>`) or accept http
   Keycloak in dev. Production requires https Keycloak (browser-facing).
6. **`OIDC_CLIENTS` redirect URIs → https** (env, §2.2).
7. **Embedded login UI (`ui/` workspace)** needs no changes: it is built into
   the service image and served from the service's own origin under
   `/interaction/assets/` — it inherits TLS automatically.
8. Review `OIDC_ALLOW_PRIVATE_NETWORK_CALLS=true` (`env/.env:50`): still needed
   for internal http calls to identity-service (§2.4); document that it must be
   `false` in production if internal calls move to public https URLs.
9. Update CORS per §2.5.

### 3.5 heka-sso-web-ui

The lightest touch — redirect URIs are self-adjusting.

1. `redirect_uri`/`post_logout_redirect_uri` use `window.location.origin`
   (`src/auth.ts`), so serving the app over https is sufficient client-side.
2. **Dev:** add `https: { key, cert }` (mkcert) plus `port: 5173` to the
   `vite.config.ts` `server` block behind an env flag — same native-TLS dev
   path as §3.3.1; the root https compose serves built output only.
3. **Prod:** `vite build` outputs static `dist/` with no server — serve from
   nginx (own location block or hostname); optionally add a Dockerfile
   (multi-stage node → nginx) to join compose.
4. `VITE_KC_URL` → https Keycloak URL (rebuild required, §2.3).
5. Keycloak-side registered redirect URIs / web origins move to https — covered
   by §3.4.4.
6. Pin `port: 5173` (and `strictPort: true`) in `vite.config.ts` so registered
   redirect URIs stay valid.

### 3.6 Optional: native TLS mode for the Nest services

For proxy-less environments, wire `APP_USE_HTTPS` (auth-service; add the same
key to sso-service's `app.config.ts`) plus `APP_SSL_KEY_PATH` /
`APP_SSL_CERT_PATH` and pass `httpsOptions: { key, cert }` to
`NestFactory.create()` in both `src/main.ts` files. Mutually exclusive with
`APP_TRUST_PROXY`. Low priority; implement only if a deployment needs it.
(identity-service's four listeners make native TLS there significantly more
invasive — Credo transports would each need HTTPS servers — so it stays
proxy-only.)

---

## 4. Phasing

**Phase 1 — Root HTTPS compose + certs (no code changes)** ✅ implemented
- Root-level `docker-compose.https.yml` (§2.1): flat service definitions
  mirroring the per-service compose files, nginx TLS terminator,
  `deploy/nginx.conf`, hostname aliases on nginx.
- mkcert setup + `docs/https-local-dev.md`.
- Backend ports stay published in this phase so existing plain-HTTP flows
  (incl. the Keycloak realm's `host.docker.internal:3005` backchannel) keep
  working; they are removed in Phase 5.
- Verify the whole stack starts with a single
  `docker compose -f docker-compose.https.yml up` and all services are
  reachable over https via the proxy (manual smoke test).

**Phase 2 — Configuration switch** ✅ implemented
- Env/compose scheme changes (§2.2) in the root compose only — the per-service
  files keep their http values.
- Keycloak realm (§3.4.4): implemented as a **separate https realm variant**
  at `deploy/keycloak/realm-heka.json`, mounted only by the root compose, so
  the original `heka-sso-service/keycloak/realm-heka.json` keeps serving the
  plain-HTTP dev flow unchanged.
- Keycloak truststore: mkcert CA copied to `deploy/certs/rootCA.pem` and
  mounted via `KC_TRUSTSTORE_PATHS` (§2.6); nginx aliases from Phase 1 resolve
  the hostnames. Keycloak's `extra_hosts`/`host.docker.internal` workaround
  is gone from the root compose.
- `app.set('trust proxy', …)` behind a new `APP_TRUST_PROXY` config flag in
  both Nest services (§3.1.1, §3.4.2), default off.
- Verify: sso discovery document shows https URLs; `Secure` cookies present;
  OIDC login flow through Keycloak works end-to-end; DIDComm/OID4VC endpoints
  advertise https/wss and a wallet can connect.

**Phase 3 — Code hardening**
- Conditional `allowInsecureHttpUrls` (§3.2.2) + insecure-endpoint startup
  warning (§3.2.1).
- Wire `APP_USE_HTTPS` field in auth-service config (§3.1.2).
- CORS wiring (§2.5).

**Phase 4 — Web-UI serving**
- Dockerfiles/static serving for both web UIs (§3.3.2, §3.5.3) incl. the
  env-driven webpack `publicPath`, dev-server native-TLS options (§3.3.1,
  §3.5.2), `prepare-demo-user.ts` fix, Vite port pin.

**Phase 5 — Docs & cleanup**
- Update READMEs (all five), `heka-sso-service/docs/THREAT-MODEL.md` deployment
  checklist (mark TLS row done), `INTEGRATION.md` examples,
  `heka-identity-service/docs/setup.md` and
  `local-config-for-heka-wallet-integration.md` (point at the new nginx setup).
- Stop publishing backend ports to the host in the root https compose.

---

## 5. Verification checklist

- [ ] `curl -v https://<host>/auth/health`, `/api/health`, sso `/health` all 200 with valid cert.
- [ ] `https://sso.<host>/.well-known/openid-configuration` — every URL in the document is https and uses the public hostname.
- [ ] Browser login flow: sso-web-ui → Keycloak → heka-sso broker → wallet login page — no mixed-content warnings, all cookies `Secure` + appropriate `SameSite`.
- [ ] Set-Cookie headers from node-oidc-provider carry `Secure` (was the THREAT-MODEL.md gap).
- [ ] DIDComm WS connects over `wss://` through the proxy (upgrade headers working).
- [ ] OID4VCI issuer metadata (`/openid/...`) advertises https; wallet issuance flow completes.
- [ ] identity-web-ui loads over https with all assets resolving (correct `publicPath`) and reaches `/api` and `/auth` without CORS errors.
- [ ] Keycloak completes broker backchannel calls (token/jwks/userinfo) against the https issuer from inside its container — CA trusted, hostname resolving to nginx.
- [ ] HMR works for both dev servers via native dev-server https (mkcert).
- [ ] `http://` → `https://` redirect on port 80.
- [ ] Single `docker compose -f docker-compose.https.yml up` from the repo root brings up the entire stack (backends, DBs, Keycloak, web UIs, nginx).
- [ ] No backend ports published to the host except via nginx (root https compose).
