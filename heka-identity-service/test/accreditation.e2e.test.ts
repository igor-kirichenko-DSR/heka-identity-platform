import { Server } from 'net'

import { Agent, DidKey, KeyDidCreateOptions, SdJwtVcRecord } from '@credo-ts/core'
import { MikroORM } from '@mikro-orm/core'
import { PostgreSqlDriver, SchemaGenerator } from '@mikro-orm/postgresql'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'

import { Agent as HekaAgent, AGENT_TOKEN } from 'src/common/agent'
import { Role } from 'src/common/auth'
import { Wallet } from 'src/common/entities'
import { uuid } from 'src/utils/misc'
import { withTenantAgent } from 'src/utils/multi-tenancy'
import { sleep } from 'src/utils/timers'

import { initializeMikroOrm, startTestApp } from './helpers'
import { createAuthToken } from './helpers/jwt'
import { createAgent, TestAgentModulesMap } from './helpers/test-agent'

const VCT = 'https://example.com/diploma'

interface ChainEntry {
  subject: string
  issuer: string
  role: string
  state: string
  credential: string
}

/**
 * Phase 7 of docs/role-model-and-oidc-providers.md: the platform accredits the organization, the organization accredits
 * its issuer, a relying party verifies an issuer's credential back to the platform DID, and removing the issuer makes
 * verifiers that check the chain reject credentials it signed, including earlier ones.
 */
describe('E2E accreditation', () => {
  const orgId = uuid()
  const issuerUserId = uuid()

  let ormSchemaGenerator: SchemaGenerator
  let orm: MikroORM<PostgreSqlDriver>
  let nestApp: INestApplication
  let app: Server
  // An independent party: the holder of the issuer's credential, and a relying party verifying accreditations
  let holder: Agent<TestAgentModulesMap>
  let holderDidUrl: string

  const tokens = {
    admin: () => createAuthToken(uuid(), Role.Admin),
    orgAdmin: () => createAuthToken(uuid(), Role.OrgAdmin, orgId),
    issuer: () => createAuthToken(issuerUserId, Role.Issuer, orgId),
    verifier: () => createAuthToken('verifier-1', Role.Verifier, orgId),
  }
  const post = async (path: string, token: Promise<string>, body: object = {}) =>
    request(app)
      .post(path)
      .auth(await token, { type: 'bearer' })
      .send(body)
  const get = async (path: string, token: Promise<string>) =>
    request(app)
      .get(path)
      .auth(await token, { type: 'bearer' })

  beforeAll(async () => {
    orm = await initializeMikroOrm()
    ormSchemaGenerator = orm.schema
    await ormSchemaGenerator.refresh()

    holder = createAgent()
    await holder.initialize()
    const { keyId } = await holder.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const holderDid = await holder.dids.create<KeyDidCreateOptions>({ method: 'key', options: { keyId } })
    const holderDidKey = DidKey.fromDid(holderDid.didState.did as string)
    holderDidUrl = `${holderDidKey.did}#${holderDidKey.publicJwk.fingerprint}`

    nestApp = await startTestApp({ roleModelEnabled: true, accreditationEnabled: true })
    app = nestApp.getHttpServer() as Server
  })

  afterAll(async () => {
    await sleep(2000)
    await nestApp.close()
    await holder.shutdown()
    await ormSchemaGenerator.clear()
    await orm.close(true)
  })

  /** The issuer signs a credential to the holder with its own DID, as an OID4VCI issuance would. */
  const issueCredential = async (issuerDid: string) => {
    const wallet = await orm.em.fork().findOneOrFail(Wallet, { id: `Issuer_${issuerUserId}_in_Organization_${orgId}` })
    const issuerDidKey = DidKey.fromDid(issuerDid)
    const sdJwtVc = await withTenantAgent(
      { agent: nestApp.get<HekaAgent>(AGENT_TOKEN), tenantId: wallet.tenantId },
      async (tenantAgent) =>
        await tenantAgent.sdJwtVc.sign({
          holder: { method: 'did', didUrl: holderDidUrl },
          issuer: { method: 'did', didUrl: `${issuerDid}#${issuerDidKey.publicJwk.fingerprint}` },
          payload: { vct: VCT, degree: 'MSc' },
        }),
    )
    await holder.sdJwtVc.store({ record: SdJwtVcRecord.fromSdJwtVc(sdJwtVc) })
  }

  /** A Verifier of the organization asks for the credential, requiring an accredited issuer. */
  const verify = async (verifierDid: string) => {
    const response = await post('/openid4vc/verification-session/request', tokens.verifier(), {
      publicVerifierId: verifierDid,
      requestSigner: { method: 'did', did: verifierDid },
      requireAccreditation: true,
      dcql: {
        query: {
          credentials: [
            { id: 'diploma', format: 'vc+sd-jwt', meta: { vct_values: [VCT] }, claims: [{ path: ['degree'] }] },
          ],
        },
      },
    })
    expect(response.status).toBe(200)

    const resolved = await holder.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(
      response.body.authorizationRequest,
    )
    const accepted = await holder.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
      authorizationRequestPayload: resolved.authorizationRequestPayload,
      dcql: { credentials: holder.openid4vc.holder.selectCredentialsForDcqlRequest(resolved.dcql!.queryResult) },
    })
    expect(accepted.serverResponse?.status).toBe(200)

    const session = await get(
      `/openid4vc/verification-session/${response.body.verificationSession.id}`,
      tokens.verifier(),
    )
    expect(session.status).toBe(200)
    return session.body
  }

  const verifyChainAsRelyingParty = async (chain: ChainEntry[]) =>
    await Promise.all(chain.map(({ credential }) => holder.sdJwtVc.verify({ compactSdJwtVc: credential })))

  test('a relying party verifies an issuer back to the platform DID until the issuer is removed', async () => {
    // 1. Onboarding: each wallet's DIDs are accredited by the wallet one level up
    const platformDid = (await post('/prepare-wallet', tokens.admin())).body.did
    const orgDid = (await post('/prepare-wallet', tokens.orgAdmin())).body.did
    const issuerDid = (await post('/prepare-wallet', tokens.issuer())).body.did
    const verifierDid = (await post('/prepare-wallet', tokens.verifier())).body.did
    for (const did of [platformDid, orgDid, issuerDid, verifierDid]) expect(did).toMatch(/^did:key:/)

    // 2. The published chain, without a token
    const chainResponse = await request(app).get(`/accreditations/${issuerDid}`)
    expect(chainResponse.status).toBe(200)
    const chain = chainResponse.body.chain as ChainEntry[]
    expect(chainResponse.body.trustAnchor).toBe(platformDid)
    expect(chain.map(({ subject, issuer, role, state }) => [subject, issuer, role, state])).toEqual([
      [issuerDid, orgDid, 'Issuer', 'active'],
      [orgDid, platformDid, 'Organization', 'active'],
    ])

    // 3. A relying party checks the credentials themselves: signatures, validity and status lists
    const verified = await verifyChainAsRelyingParty(chain)
    expect(verified.map((result) => result.isValid)).toEqual([true, true])
    for (const [index, result] of verified.entries()) {
      if (!result.isValid) continue
      expect(result.sdJwtVc.payload).toMatchObject({
        iss: chain[index].issuer,
        sub: chain[index].subject,
        org_id: orgId,
      })
    }

    const statusListUri = (verified[0] as { sdJwtVc: { payload: { status: { status_list: { uri: string } } } } })
      .sdJwtVc.payload.status.status_list.uri
    const statusList = await request(app).get(new URL(statusListUri).pathname)
    expect(statusList.status).toBe(200)
    expect(statusList.headers['content-type']).toContain('application/statuslist+jwt')

    // 4. Heka's own verification policy accepts a credential of the accredited issuer
    await issueCredential(issuerDid)
    const accepted = await verify(verifierDid)
    expect(accepted.state).toBe('ResponseVerified')
    expect(accepted.accreditation).toEqual({
      verified: true,
      issuers: [{ did: issuerDid, verified: true, trustAnchor: platformDid }],
    })
    expect(accepted.sharedAttributes).toMatchObject({ degree: 'MSc' })

    // 5. Only the parent can revoke: not the platform, not the issuer itself
    expect((await post('/accreditations/revoke', tokens.admin(), { did: issuerDid })).status).toBe(403)
    expect((await post('/accreditations/revoke', tokens.issuer(), { did: issuerDid })).status).toBe(403)

    // 6. The OrgAdmin removes the issuer
    const revoked = await post('/accreditations/revoke', tokens.orgAdmin(), { did: issuerDid, reason: 'left' })
    expect(revoked.status).toBe(200)
    expect(revoked.body).toEqual({ revoked: [issuerDid] })

    // The relying party sees the revocation in the organization's status list
    const afterRevocation = await verifyChainAsRelyingParty(
      (await request(app).get(`/accreditations/${issuerDid}`)).body.chain as ChainEntry[],
    )
    expect(afterRevocation.map((result) => result.isValid)).toEqual([false, true])

    // Heka's verification rejects the credential the issuer signed before it was removed
    const rejected = await verify(verifierDid)
    expect(rejected.state).toBe('Error')
    expect(rejected.errorMessage).toBe(`The accreditation of ${issuerDid} is revoked`)
    expect(rejected.sharedAttributes).toBeUndefined()

    // A new prepare-wallet does not quietly re-accredit the removed issuer
    expect((await post('/prepare-wallet', tokens.issuer())).status).toBe(201)
    expect((await verify(verifierDid)).state).toBe('Error')

    // 7. The OrgAdmin can reinstate it
    expect((await post('/accreditations/reinstate', tokens.orgAdmin(), { did: issuerDid })).status).toBe(201)
    expect((await verify(verifierDid)).state).toBe('ResponseVerified')

    // 8. Offboarding the organization breaks the chain of all its issuers
    const offboarded = await post('/accreditations/revoke', tokens.admin(), { orgId })
    expect(offboarded.body.revoked).toContain(orgDid)
    const afterOffboarding = await verify(verifierDid)
    expect(afterOffboarding.state).toBe('Error')
    expect(afterOffboarding.errorMessage).toBe(`The accreditation of ${orgDid} is revoked`)
  })

  test('the status list of an unknown id and the chain of an unaccredited DID are 404', async () => {
    expect((await request(app).get('/accreditations/status-lists/unknown')).status).toBe(404)
    expect((await request(app).get('/accreditations/did:key:z6MkunknownDid')).status).toBe(404)
  })
})
