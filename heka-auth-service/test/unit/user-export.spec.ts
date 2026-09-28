import { hash } from 'argon2'

import {
  auth0PlaceholderEmail,
  AuthUser,
  exportUsers,
  parseArgon2Hash,
  toAuth0User,
  toKeycloakCredential,
  toKeycloakPartialImport,
  toKeycloakUser,
} from '../../src/migration/user-export'

// A hash produced by the `argon2` package with its defaults (argon2id, v=19, m=65536, t=3, p=4, 32-byte hash).
const ENCODED = '$argon2id$v=19$m=65536,t=3,p=4$YWJjZGVmZ2hpamtsbW5vcA$K0hM9m0ZVzEpZk8ClqYMxsUgHOdQeHZgO+5nNgjUEUA'

const user = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: '7531a1f6-822d-446d-b878-658616a4df15',
  name: 'demo',
  role: 'Admin',
  password: ENCODED,
  ...overrides,
})

describe('parseArgon2Hash', () => {
  test('splits the encoded form into variant, parameters, salt and hash bytes', () => {
    const parsed = parseArgon2Hash(ENCODED)

    expect(parsed).toMatchObject({ variant: 'argon2id', version: 19, memoryKiB: 65536, iterations: 3, parallelism: 4 })
    expect(parsed.salt.toString()).toBe('abcdefghijklmnop')
    expect(parsed.hash).toHaveLength(32)
  })

  test('round-trips a hash produced by the argon2 package', async () => {
    const encoded = await hash('Password1234!')
    const parsed = parseArgon2Hash(encoded)

    expect(parsed.variant).toBe('argon2id')
    expect(parsed.salt).toHaveLength(16)
    expect(parsed.hash).toHaveLength(32)
  })

  test('rejects anything else', () => {
    expect(() => parseArgon2Hash('plain-text')).toThrow(/not an encoded argon2 hash/)
    expect(() => parseArgon2Hash('$2b$12$abcdefghijklmnopqrstuu')).toThrow(/not an encoded argon2 hash/)
  })
})

describe('Keycloak export', () => {
  test('stores the hash and salt as base64 with the argon2 parameters Keycloak expects', () => {
    const credential = toKeycloakCredential(ENCODED)

    expect(credential.type).toBe('password')
    expect(JSON.parse(credential.secretData)).toEqual({
      value: Buffer.from('K0hM9m0ZVzEpZk8ClqYMxsUgHOdQeHZgO+5nNgjUEUA', 'base64').toString('base64'),
      salt: Buffer.from('abcdefghijklmnop').toString('base64'),
      additionalParameters: {},
    })
    expect(JSON.parse(credential.credentialData)).toEqual({
      hashIterations: 3,
      algorithm: 'argon2',
      additionalParameters: {
        hashLength: ['32'],
        memory: ['65536'],
        type: ['id'],
        version: ['1.3'],
        parallelism: ['4'],
      },
    })
  })

  test('keeps the user id, sets heka_uid and puts Admin users into the default group', () => {
    const exported = toKeycloakUser(user())

    expect(exported).toEqual({
      id: '7531a1f6-822d-446d-b878-658616a4df15',
      username: 'demo',
      enabled: true,
      emailVerified: false,
      attributes: { heka_uid: ['7531a1f6-822d-446d-b878-658616a4df15'] },
      credentials: [expect.objectContaining({ type: 'password' })],
      groups: ['/heka-users'],
    })
  })

  test('gives organization roles the client role and the org id attribute instead of the group', () => {
    const exported = toKeycloakUser(user({ name: 'doctor', role: 'Issuer' }), { orgId: 'org-1' })

    expect(exported.groups).toBeUndefined()
    expect(exported.clientRoles).toEqual({ 'heka-identity-service': ['Issuer'] })
    expect(exported.attributes).toEqual({ heka_uid: ['7531a1f6-822d-446d-b878-658616a4df15'], org_id: ['org-1'] })
  })

  test('gives the User role its client role without an org id', () => {
    const exported = toKeycloakUser(user({ role: 'User' }), { orgId: 'org-1' })

    expect(exported.clientRoles).toEqual({ 'heka-identity-service': ['User'] })
    expect(exported.attributes).toEqual({ heka_uid: ['7531a1f6-822d-446d-b878-658616a4df15'] })
  })

  test('refuses organization roles without an org id and unknown roles', () => {
    expect(() => toKeycloakUser(user({ role: 'Verifier' }))).toThrow(/no org id is configured/)
    expect(() => toKeycloakUser(user({ role: 'Superuser' }))).toThrow(/unknown role 'Superuser'/)
  })

  test('can leave the passwords out and require a new one', () => {
    const exported = toKeycloakUser(user(), { withoutPasswords: true })

    expect(exported.credentials).toBeUndefined()
    expect(exported.requiredActions).toEqual(['UPDATE_PASSWORD'])
  })

  test('wraps the users in a partial import that skips existing resources', () => {
    const partialImport = toKeycloakPartialImport([user(), user({ id: 'u2', name: 'other' })])

    expect(partialImport.ifResourceExists).toBe('SKIP')
    expect(partialImport.users.map((u) => u.username)).toEqual(['demo', 'other'])
  })
})

describe('Auth0 export', () => {
  test('synthesizes an e-mail from the username', () => {
    expect(auth0PlaceholderEmail('demo')).toBe('demo@heka.invalid')
    expect(auth0PlaceholderEmail('John Doe (org)', 'example.org')).toBe('john_doe__org_@example.org')
  })

  test('keeps the user id, passes the encoded hash through and sets the Heka metadata', () => {
    const exported = toAuth0User(user())

    expect(exported).toEqual({
      user_id: '7531a1f6-822d-446d-b878-658616a4df15',
      email: 'demo@heka.invalid',
      email_verified: false,
      username: 'demo',
      name: 'demo',
      custom_password_hash: { algorithm: 'argon2', hash: { value: ENCODED } },
      app_metadata: { heka_uid: '7531a1f6-822d-446d-b878-658616a4df15', heka_role: 'Admin' },
    })
  })

  test('adds the org id for organization roles and honours the e-mail domain', () => {
    const exported = toAuth0User(user({ name: 'doctor', role: 'Issuer' }), {
      orgId: 'org-1',
      emailDomain: 'example.org',
    })

    expect(exported.email).toBe('doctor@example.org')
    expect(exported.app_metadata).toEqual({
      heka_uid: '7531a1f6-822d-446d-b878-658616a4df15',
      heka_role: 'Issuer',
      org_id: 'org-1',
    })
  })

  test('can leave the passwords out', () => {
    expect(toAuth0User(user(), { withoutPasswords: true }).custom_password_hash).toBeUndefined()
  })

  test('refuses a password that is not an argon2 hash', () => {
    expect(() => toAuth0User(user({ password: 'plain' }))).toThrow(/not an encoded argon2 hash/)
  })
})

describe('exportUsers', () => {
  test('selects the format by target', () => {
    expect(exportUsers('keycloak', [user()])).toMatchObject({ ifResourceExists: 'SKIP' })
    expect(exportUsers('auth0', [user()])).toEqual([expect.objectContaining({ user_id: user().id })])
    expect(() => exportUsers('okta' as never, [])).toThrow(/unknown target 'okta'/)
  })
})
