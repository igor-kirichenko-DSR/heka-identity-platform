# Local HTTPS setup

How to run the whole Heka platform over HTTPS with a single command, using the
root-level [`docker-compose.https.yml`](../docker-compose.https.yml) and an
nginx TLS terminator ([`deploy/nginx.conf`](../deploy/nginx.conf)). Background
and rationale: [HTTPS-Support-Plan.md](HTTPS-Support-Plan.md).

The per-service compose files remain the plain-HTTP standalone workflow; this
setup is additive.

## Prerequisites

- Docker with Compose v2.20+
- [mkcert](https://github.com/FiloSottile/mkcert) (`choco install mkcert` /
  `brew install mkcert`)
- Node 22 + yarn (only if you want the web UIs served — see below)

## 1. Certificates (one-time)

Install the local CA into your system/browser trust store, then generate one
certificate covering all public hostnames. From the repo root:

```shell
mkcert -install
mkcert -cert-file deploy/certs/cert.pem -key-file deploy/certs/key.pem \
  heka.localhost sso.localhost kc.localhost localhost 127.0.0.1 ::1
```

`deploy/certs/` is git-ignored — never commit certificates.

## 2. Build the service images

```shell
docker compose -f docker-compose.https.yml build
```

## 3. (Optional) build the web UIs

nginx serves the built output of both web UIs; until they are built, those
locations return 404 (the backends work regardless).

```shell
# demo RP, served at https://heka.localhost/
yarn --cwd heka-sso-web-ui install
yarn --cwd heka-sso-web-ui build

# identity web UI, served at https://heka.localhost/idw/
# NOTE: asset URLs only resolve once the build supports publicPath=/idw/
# (plan §3.3.2, Phase 4) — until then use its dev server instead.
yarn --cwd heka-identity-service-web-ui install
yarn --cwd heka-identity-service-web-ui build:prod
```

## 4. Start everything

```shell
docker compose -f docker-compose.https.yml up -d
```

## 5. Smoke test

| URL | Expect |
|---|---|
| `https://heka.localhost/auth/health` | 200 from heka-auth-service |
| `https://heka.localhost/api/health` | 200 from heka-identity-service |
| `https://sso.localhost/health` | 200 from heka-sso-service |
| `https://sso.localhost/.well-known/openid-configuration` | OIDC discovery JSON |
| `https://kc.localhost/` | Keycloak welcome page |
| `https://heka.localhost/` | heka-sso-web-ui (404 until built) |
| `http://heka.localhost/` | 301 redirect to https |

```shell
curl https://heka.localhost/auth/health
curl https://heka.localhost/api/health
curl https://sso.localhost/health
```

Browsers resolve `*.localhost` to `127.0.0.1` automatically. If `curl` (or
another tool) on your machine does not, either add hosts-file entries

```
127.0.0.1 heka.localhost sso.localhost kc.localhost
```

(`C:\Windows\System32\drivers\etc\hosts` on Windows, `/etc/hosts` elsewhere)
or use `curl --resolve heka.localhost:443:127.0.0.1 ...`.

## Notes and current limitations (Phase 1)

- **Services still advertise `http://` URLs.** Phase 1 is infrastructure only:
  the sso issuer, agent endpoints, and Keycloak realm URLs still point at the
  published `localhost` ports, so existing plain-HTTP flows keep working
  side-by-side. Phase 2 of the plan switches them to the https origins.
- **Backend ports are still published to the host** (3000–3005, 8080, DB
  ports) for the same reason. They are removed in Phase 5.
- **Port 443 already taken or privileged?** Change the nginx port mapping in
  `docker-compose.https.yml` to `'8443:443'` and use `https://heka.localhost:8443/…`.
- **Certificates expired or hostnames changed?** Re-run the `mkcert` command
  from step 1 and restart the nginx container.
