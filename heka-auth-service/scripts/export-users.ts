/**
 * Exports heka-auth-service accounts in the import format of the OIDC provider that replaces it.
 *
 *   yarn export-users --target keycloak [--out users.keycloak.json] [--org-id <id>] [--user <name>] [--without-passwords]
 *   yarn export-users --target auth0    [--out users.auth0.json]    [--org-id <id>] [--user <name>] [--without-passwords] [--email-domain heka.invalid]
 *
 * Reads `auth_user` with the service's own database settings (`env/.env`, `DB_*`). `--org-id` defaults to
 * `ORG_ID`, the organization heka-auth-service put into tokens of organization roles. Writes to stdout
 * when `--out` is omitted. The README describes how to import each file.
 */
import * as fs from 'node:fs'
import { parseArgs } from 'node:util'

import { MikroORM } from '@mikro-orm/postgresql'

import ormConfig from '../src/core/database/database.options.cli'
import { AuthUser, ExportOptions, ExportTarget, exportTargets, exportUsers } from '../src/migration/user-export'

const { values } = parseArgs({
  options: {
    target: { type: 'string', short: 't' },
    out: { type: 'string', short: 'o' },
    'org-id': { type: 'string' },
    user: { type: 'string', short: 'u' },
    'email-domain': { type: 'string' },
    'without-passwords': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

const usage = `usage: export-users --target <${exportTargets.join('|')}> [--out <file>] [--org-id <id>] [--user <name>] [--without-passwords] [--email-domain <domain>]`

async function main(): Promise<void> {
  if (values.help) {
    console.log(usage)
    return
  }
  const target = values.target as ExportTarget | undefined
  if (!target || !exportTargets.includes(target)) {
    throw new Error(usage)
  }
  const options: ExportOptions = {
    orgId: values['org-id'] ?? process.env.ORG_ID ?? undefined,
    emailDomain: values['email-domain'],
    withoutPasswords: values['without-passwords'],
  }

  const orm = await MikroORM.init({ ...ormConfig, logger: () => undefined, debug: false })
  let users: AuthUser[]
  try {
    const where = values.user ? 'where name = ?' : ''
    users = await orm.em
      .getConnection()
      .execute<AuthUser[]>(
        `select id, name, role, password from auth_user ${where} order by created_at, name`,
        values.user ? [values.user] : [],
      )
  } finally {
    await orm.close(true)
  }
  if (values.user && users.length === 0) {
    throw new Error(`user '${values.user}' not found`)
  }

  const output = JSON.stringify(exportUsers(target, users, options), null, 2)
  if (values.out) {
    fs.writeFileSync(values.out, `${output}\n`, { encoding: 'utf8' })
    console.error(`exported ${users.length} user(s) for ${target} to ${values.out}`)
  } else {
    console.log(output)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
