# Heka Auth Service

## Description

Authentication service for the [Heka Identity Service](https://github.com/hiero-ledger/heka-identity-platform/tree/main/heka-identity-service). Issues JWTs that the Identity Service validates against a shared secret — see [JWT alignment with Identity Service](#jwt-alignment-with-identity-service) below.

## Quick Start

1. Start a local Postgres compatible with the service defaults:

   ```bash
   docker run --name heka-auth-service-postgres \
     -e POSTGRES_DB=heka-auth-service \
     -e POSTGRES_USER=heka \
     -e POSTGRES_PASSWORD=heka1 \
     -p 5433:5432 -d postgres
   ```

2. Enable Corepack so the pinned Yarn 4 runs, then install dependencies. The repo pins `yarn@4.16.0` in `package.json`; without Corepack the system Yarn 1.x may run instead and produce unexpected lockfile behavior:

   ```bash
   corepack enable
   yarn install
   ```

3. (Optional) Create a `.env` file in the repo root to override any defaults — see [Configuration](#configuration) for the available variables.

4. Run database migrations:

   ```bash
   yarn migration:up
   ```

5. Start the service:

   ```bash
   yarn start
   ```

6. Verify by opening Swagger UI at <http://localhost:3004/api/docs>.

## API

The service exposes a REST API at port `3004` by default. Swagger UI is available at `/api/docs` (e.g. <http://localhost:3004/api/docs>). Endpoints are grouped by controller:

- **OAuth** (`/api/v1/oauth/*`) — token issuance, refresh, revocation.
- **User** (`/api/v1/user/*`) — user management.
- **Health** (`/health`) — memory + database health probe for use as a Kubernetes readiness/liveness check or a Compose healthcheck.

## Configuration

The service is configured via environment variables. Values can be set in a `.env` file at the repo root. All variables are optional — defaults are compiled in (see the tables below).

### Application

| Variable                 | Default                       | Description                                                              |
|--------------------------|-------------------------------|--------------------------------------------------------------------------|
| `APP_NAME`               | `Heka Auth Service`           | Application name surfaced in metadata.                                   |
| `APP_VERSION`            | _(reads from `package.json`)_ | Application version surfaced in metadata.                                |
| `APP_PORT`               | `3004`                        | HTTP port the service binds to.                                          |
| `APP_PREFIX`             | `api`                         | URL prefix for the REST API.                                             |
| `APP_REQUEST_SIZE_LIMIT` | `50mb`                        | Maximum request body size.                                               |
| `APP_ENABLE_CORS`        | `false`                       | Set to `true` to enable CORS handling.                                   |
| `APP_ALLOW_ORIGINS`      | `*`                           | Comma-separated list of allowed CORS origins.                            |
| `ORG_ID`                 | `id`                          | Organization identifier surfaced as the `org_id` claim in issued tokens. |

### Database (PostgreSQL)

| Variable      | Default             | Description                                                   |
|---------------|---------------------|---------------------------------------------------------------|
| `DB_HOST`     | `localhost`         | Database host.                                                |
| `DB_PORT`     | `5433`              | Database port.                                                |
| `DB_NAME`     | `heka-auth-service` | Database name.                                                |
| `DB_USER`     | `heka`              | Database user.                                                |
| `DB_PASSWORD` | `heka1`             | Database password. **Replace in any non-trivial deployment.** |

### Authentication (JWT)

| Variable                    | Default                 | Description                                                                                                                   |
|-----------------------------|-------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| `JWT_ISSUER`                | `Heka`                  | Value emitted in the `iss` claim.                                                                                             |
| `JWT_AUDIENCE`              | `Heka Identity Service` | Value emitted in the `aud` claim.                                                                                             |
| `JWT_SECRET`                | `test`                  | HMAC secret used to sign tokens. **Replace in any non-trivial deployment.**                                                   |
| `JWT_ACCESS_EXPIRY`         | `3600` (1 h)            | Access-token lifetime in seconds.                                                                                             |
| `JWT_REFRESH_EXPIRY`        | `86400` (24 h)          | Refresh-token lifetime in seconds.                                                                                            |
| `DEMO_USER`                 | _(unset)_               | Optional pre-provisioned demo user identifier. When set, tokens for this user are issued with an extended lifetime (~1 year). |
| `EXPIRE_IN_PASSWORD_CHANGE` | `3600`                  | Lifetime in seconds of password-change tokens.                                                                                |

#### JWT Alignment with Identity Service

The Identity Service validates JWTs issued by this service against a shared secret and matching `iss` / `aud` claims. **Both services must be configured with the same values:**

| Variable here  | Variable in Identity Service  |
|----------------|-------------------------------|
| `JWT_SECRET`   | `JWT_SECRET`                  |
| `JWT_ISSUER`   | `JWT_VERIFY_OPTIONS_ISSUER`   |
| `JWT_AUDIENCE` | `JWT_VERIFY_OPTIONS_AUDIENCE` |

Tokens issued by this service include the claims `sub`, `roles[]`, `name`, and optional `org_id`, matching the [Identity Service's required JWT claims](../heka-identity-service/docs/setup.md#required-jwt-claims).

### Logging

| Variable            | Default                                                          | Description                                                           |
|---------------------|------------------------------------------------------------------|-----------------------------------------------------------------------|
| `LOG_LEVEL`         | `info`                                                           | Log level. One of `trace`, `debug`, `info`, `warn`, `error`, `fatal`. |
| `LOG_EXCLUDE_URLS`  | _(unset — none excluded)_                                        | Comma-separated list of URL paths to exclude from request logging.    |
| `LOG_REDACT_FIELDS` | `db.host,db.user,db.password,jwt.issuer,jwt.audience,jwt.secret` | Comma-separated list of dotted field paths redacted from log output.  |

### Health

`GET /health` checks memory usage and database connectivity. The thresholds below define when memory health is reported as unhealthy:

| Variable                          | Default | Description                                                       |
|-----------------------------------|---------|-------------------------------------------------------------------|
| `HEALTH_MEMORY_HEAP_THRESHOLD_MB` | `2048`  | Heap usage threshold above which `memory_heap` reports unhealthy. |
| `HEALTH_MEMORY_RSS_THRESHOLD_MB`  | `2048`  | RSS usage threshold above which `memory_rss` reports unhealthy.   |

### Runtime

| Variable   | Default   | Description                                                              |
|------------|-----------|--------------------------------------------------------------------------|
| `NODE_ENV` | _(unset)_ | When set to `production`, switches the logger to non-pretty JSON output. |

## Exporting users to the OIDC provider

heka-auth-service is being replaced by a third-party OpenID Connect provider (plan: [`docs/keycloak-replacement-for-auth-service.md`](../docs/keycloak-replacement-for-auth-service.md), sections 8 and 10). `scripts/export-users.ts` reads `auth_user` with the service's own `DB_*` settings and writes the provider's import format, so users keep their **id, username, role and password**:

```bash
yarn export-users --target keycloak --out users.keycloak.json
yarn export-users --target auth0 --out users.auth0.json
```

| Flag                  | Default                | Description                                                                                                                      |
|-----------------------|------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| `--target`            | _(required)_           | `keycloak` (partial-import JSON with `ifResourceExists: SKIP`) or `auth0` (bulk-import JSON).                                     |
| `--out`               | _(stdout)_             | Output file.                                                                                                                     |
| `--org-id`            | `ORG_ID`               | `org_id` given to users with an organization role (`OrgAdmin`, `OrgManager`, `OrgMember`, `Issuer`, `Verifier`), as the tokens carried it. |
| `--user`              | _(all users)_          | Export a single account, e.g. to verify the import with one user first.                                                          |
| `--without-passwords` | off                    | Leave the password hashes out. Keycloak users then get the `UPDATE_PASSWORD` required action; on both providers an administrator has to set a temporary password or trigger a reset. |
| `--email-domain`      | `heka.invalid`         | Auth0 only: domain of the synthesized e-mail addresses (Auth0 requires one per user; accounts here have none).                    |

What the files contain, per user: the original UUID as the provider's user id **and** as `heka_uid` (Keycloak: user attribute; Auth0: `app_metadata.heka_uid`), so heka-identity-service derives the same tenant as before and existing schemas and DIDs stay reachable; the role (Keycloak: `Admin` users join the `heka-users` default group, other roles become the matching client role of `heka-identity-service`; Auth0: `app_metadata.heka_role`); and the argon2id password hash (Keycloak: split into `secretData` / `credentialData` for its built-in `argon2` provider; Auth0: the encoded string as `custom_password_hash`).

Import:

- **Keycloak** (realm `heka-platform`): `POST /admin/realms/heka-platform/partialImport` with the file as body and an admin token, or Realm settings → Action → Partial import in the console. Existing usernames are skipped. See [`heka-sso-service/keycloak/README.md`](../heka-sso-service/keycloak/README.md#migrating-users-from-heka-auth-service).
- **Auth0**: `auth0 users import -c Username-Password-Authentication --users "$(cat users.auth0.json)" --upsert=false --email-results=false --no-input`, then poll the job with `auth0 api get jobs/<id>`; files are limited to 500 KB per job. See [`heka-sso-service/auth0/README.md`](../heka-sso-service/auth0/README.md#migrating-users-from-heka-auth-service).

Verified on 2026-09-21 with one account on each provider: the imported user logged in with the old password, a wrong password was refused, and the access token carried the original id as `heka_uid` and the role `Admin`.

## Migrations

Database schema is managed via migrations stored in `./migrations`. Run `yarn migration:up` before the first start and after pulling changes that include new migrations.

```bash
# Migrate database to the latest version
yarn migration:up

# Show migration:up help
yarn migration:up -- -h

# Migrate one version down. Note: down migrations are not currently supported.
yarn migration:down

# List applied migrations
yarn migration:list

# List pending migrations
yarn migration:pending

# Generate a new migration as a diff between current DB and updated model
yarn migration:create

# Drop database schema and migrations table.
# Skip --drop-migrations-table to keep the migrations table; remove -r to print help.
yarn schema:drop -- --drop-migrations-table -r
```

## Docker

To build the image locally:

```bash
docker compose -f docker-compose.dev.yml build
```

To run the service in Docker:

```bash
docker compose -f docker-compose.dev.yml up -d
```

## Testing

### Unit tests

```bash
yarn test
```

### E2E tests

E2E tests require a running Postgres instance. The quickest way is to reuse the container from [Quick Start](#quick-start):

```bash
docker run --name heka-auth-service-postgres \
  -e POSTGRES_DB=heka-auth-service \
  -e POSTGRES_USER=heka \
  -e POSTGRES_PASSWORD=heka1 \
  -p 5433:5432 -d postgres
```

Since the Quick Start container maps to host port `5433`, override the default when running tests locally:

```bash
MIKRO_ORM_HOST=127.0.0.1 MIKRO_ORM_PORT=5433 yarn test
```

If your Postgres is on the standard port `5432`, no override is needed:

```bash
yarn test
```