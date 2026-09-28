/**
 * Turns heka-auth-service accounts into the import formats of the OIDC providers that replace it
 * (plan: docs/keycloak-replacement-for-auth-service.md, section 10). Pure functions; the CLI in
 * `scripts/export-users.ts` reads the database and writes the files.
 *
 * Every export keeps the original user id as the provider-independent Heka user id (`heka_uid`),
 * so the identity-service tenant of a migrated user (derived from role, user id and org id) is the
 * same before and after the migration and on both providers.
 */

export type ExportTarget = 'keycloak' | 'auth0'
export const exportTargets: ExportTarget[] = ['keycloak', 'auth0']

export const hekaRoles = ['Admin', 'OrgAdmin', 'OrgManager', 'OrgMember', 'Issuer', 'Verifier', 'User'] as const
export type HekaRole = (typeof hekaRoles)[number]

/** Roles whose tenant is an organization; heka-auth-service put the deployment's `ORG_ID` in their tokens. */
export const orgRoles: ReadonlySet<HekaRole> = new Set(['OrgAdmin', 'OrgManager', 'OrgMember', 'Issuer', 'Verifier'])

/** One `auth_user` row. */
export interface AuthUser {
  id: string
  name: string
  role: string
  /** Encoded argon2 hash as stored by the `argon2` package, e.g. `$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>`. */
  password: string
}

export interface ExportOptions {
  /** `org_id` given to users with an organization role (heka-auth-service's `ORG_ID`). */
  orgId?: string
  /** Auth0 only: domain of the synthesized e-mail addresses (`<username>@<domain>`). */
  emailDomain?: string
  /** Emit the users without their password hash; they must set a new one (see the README). */
  withoutPasswords?: boolean
}

export interface Argon2Hash {
  /** `argon2id`, `argon2i` or `argon2d`. */
  variant: string
  /** Argon2 version number as encoded (`19` = 0x13 = 1.3, `16` = 1.0). */
  version: number
  memoryKiB: number
  iterations: number
  parallelism: number
  salt: Buffer
  hash: Buffer
}

const ARGON2_PATTERN =
  /^\$(argon2(?:id|i|d))\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+=*)\$([A-Za-z0-9+/]+=*)$/

/** Parses the PHC-style encoded hash produced by the `argon2` package (and everything else that follows the reference format). */
export function parseArgon2Hash(encoded: string): Argon2Hash {
  const match = ARGON2_PATTERN.exec(encoded)
  if (!match) {
    throw new Error('password is not an encoded argon2 hash ($argon2id$v=19$m=...,t=...,p=...$<salt>$<hash>)')
  }
  const [, variant, version, memory, iterations, parallelism, salt, hash] = match
  return {
    variant,
    version: parseInt(version, 10),
    memoryKiB: parseInt(memory, 10),
    iterations: parseInt(iterations, 10),
    parallelism: parseInt(parallelism, 10),
    salt: Buffer.from(salt, 'base64'),
    hash: Buffer.from(hash, 'base64'),
  }
}

export function assertHekaRole(role: string, user: string): asserts role is HekaRole {
  if (!(hekaRoles as readonly string[]).includes(role)) {
    throw new Error(`user '${user}' has unknown role '${role}'`)
  }
}

const orgIdFor = (role: HekaRole, user: string, orgId: string | undefined): string | undefined => {
  if (!orgRoles.has(role)) return undefined
  if (!orgId) {
    throw new Error(`user '${user}' has organization role '${role}' but no org id is configured (--org-id / ORG_ID)`)
  }
  return orgId
}

// --- Keycloak ---------------------------------------------------------------------------------

/** Keycloak's argon2 provider ids for the encoded variant and version. */
const keycloakArgon2Type: Record<string, string> = { argon2id: 'id', argon2i: 'i', argon2d: 'd' }
const keycloakArgon2Version: Record<number, string> = { 19: '1.3', 16: '1.0' }

export interface KeycloakCredential {
  type: 'password'
  userLabel: string
  /** JSON: `{ value: <base64 hash>, salt: <base64 salt>, additionalParameters: {} }`. */
  secretData: string
  /** JSON: `{ hashIterations, algorithm: 'argon2', additionalParameters: { hashLength, memory, type, version, parallelism } }`. */
  credentialData: string
}

export interface KeycloakUser {
  id: string
  username: string
  enabled: true
  emailVerified: false
  attributes: Record<string, string[]>
  credentials?: KeycloakCredential[]
  requiredActions?: string[]
  /** `Admin` users join the realm's default group, which carries `heka-identity-service.Admin`. */
  groups?: string[]
  /** Other roles are client roles of `heka-identity-service`, exactly one per user. */
  clientRoles?: Record<string, string[]>
}

export interface KeycloakPartialImport {
  ifResourceExists: 'SKIP'
  users: KeycloakUser[]
}

export const keycloakIdentityClient = 'heka-identity-service'
export const keycloakDefaultGroup = '/heka-users'

/** The credential representation Keycloak's built-in `argon2` hash provider verifies (secret and parameters stored separately). */
export function toKeycloakCredential(encoded: string): KeycloakCredential {
  const hash = parseArgon2Hash(encoded)
  const type = keycloakArgon2Type[hash.variant]
  const version = keycloakArgon2Version[hash.version]
  if (!type || !version) {
    throw new Error(`argon2 variant '${hash.variant}' version ${hash.version} is not supported by Keycloak`)
  }
  return {
    type: 'password',
    userLabel: 'Migrated from heka-auth-service',
    secretData: JSON.stringify({
      value: hash.hash.toString('base64'),
      salt: hash.salt.toString('base64'),
      additionalParameters: {},
    }),
    credentialData: JSON.stringify({
      hashIterations: hash.iterations,
      algorithm: 'argon2',
      additionalParameters: {
        hashLength: [String(hash.hash.length)],
        memory: [String(hash.memoryKiB)],
        type: [type],
        version: [version],
        parallelism: [String(hash.parallelism)],
      },
    }),
  }
}

export function toKeycloakUser(user: AuthUser, options: ExportOptions = {}): KeycloakUser {
  assertHekaRole(user.role, user.name)
  const orgId = orgIdFor(user.role, user.name, options.orgId)

  const result: KeycloakUser = {
    id: user.id,
    username: user.name,
    enabled: true,
    emailVerified: false,
    attributes: { heka_uid: [user.id], ...(orgId ? { org_id: [orgId] } : {}) },
  }
  if (options.withoutPasswords) {
    result.requiredActions = ['UPDATE_PASSWORD']
  } else {
    result.credentials = [toKeycloakCredential(user.password)]
  }
  if (user.role === 'Admin') {
    result.groups = [keycloakDefaultGroup]
  } else {
    result.clientRoles = { [keycloakIdentityClient]: [user.role] }
  }
  return result
}

export function toKeycloakPartialImport(users: AuthUser[], options: ExportOptions = {}): KeycloakPartialImport {
  return { ifResourceExists: 'SKIP', users: users.map((user) => toKeycloakUser(user, options)) }
}

// --- Auth0 ------------------------------------------------------------------------------------

export interface Auth0ImportUser {
  /** Becomes `auth0|<id>`; the original id also travels in `app_metadata.heka_uid`. */
  user_id: string
  email: string
  email_verified: false
  username: string
  name: string
  custom_password_hash?: { algorithm: 'argon2'; hash: { value: string } }
  app_metadata: { heka_uid: string; heka_role: HekaRole; org_id?: string }
}

export const auth0DefaultEmailDomain = 'heka.invalid'

/** heka-auth-service accounts have no e-mail, which Auth0 requires: `<username>@<domain>` with characters outside the local-part alphabet replaced. */
export function auth0PlaceholderEmail(username: string, domain = auth0DefaultEmailDomain): string {
  const local = username.toLowerCase().replace(/[^a-z0-9._+-]/g, '_')
  return `${local}@${domain}`
}

export function toAuth0User(user: AuthUser, options: ExportOptions = {}): Auth0ImportUser {
  assertHekaRole(user.role, user.name)
  const orgId = orgIdFor(user.role, user.name, options.orgId)

  const result: Auth0ImportUser = {
    user_id: user.id,
    email: auth0PlaceholderEmail(user.name, options.emailDomain),
    email_verified: false,
    username: user.name,
    name: user.name,
    app_metadata: { heka_uid: user.id, heka_role: user.role, ...(orgId ? { org_id: orgId } : {}) },
  }
  if (!options.withoutPasswords) {
    parseArgon2Hash(user.password) // fail early on a hash Auth0 would reject
    result.custom_password_hash = { algorithm: 'argon2', hash: { value: user.password } }
  }
  return result
}

export function toAuth0Import(users: AuthUser[], options: ExportOptions = {}): Auth0ImportUser[] {
  return users.map((user) => toAuth0User(user, options))
}

// --- Entry point ------------------------------------------------------------------------------

export function exportUsers(target: ExportTarget, users: AuthUser[], options: ExportOptions = {}): unknown {
  switch (target) {
    case 'keycloak':
      return toKeycloakPartialImport(users, options)
    case 'auth0':
      return toAuth0Import(users, options)
    default:
      throw new Error(`unknown target '${String(target)}' (expected ${exportTargets.join(' | ')})`)
  }
}
