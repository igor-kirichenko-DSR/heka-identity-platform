import { createMock } from '@golevelup/ts-vitest'
import { EntityManager } from '@mikro-orm/core'
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'

import { Agent, TenantAgent } from 'common/agent'
import { AuthInfo, Role } from 'common/auth'
import { AuthorizationService } from 'common/authz'
import { DidHierarchyService } from 'common/did-hierarchy'
import { Accreditation, AccreditedRole, TokenStatusList } from 'common/entities'
import { Logger } from 'common/logger'
import AccreditationConfig from 'config/accreditation'

import { didRecordStub } from '../../../test/helpers/mock-records'
import { AccreditationService } from '../accreditation.service'
import { TokenStatus, TokenStatusListService } from '../token-status-list.service'

const DAY = 24 * 60 * 60 * 1000
const PLATFORM = 'did:key:platform'
const ORG = 'did:key:org'
const ISSUER = 'did:key:issuer'

const accreditation = (props: Partial<Accreditation> & { subjectDid: string; issuerDid: string }) => {
  const result = new Accreditation({
    subjectWalletId: 'Issuer_u1_in_Organization_org-1',
    issuerWalletId: 'Organization_org-1',
    orgId: 'org-1',
    accreditedRole: AccreditedRole.Issuer,
    credential: 'sd-jwt',
    statusList: { id: 'list-1' } as TokenStatusList,
    statusIndex: 0,
    validFrom: new Date(Date.now() - DAY),
    validUntil: new Date(Date.now() + 300 * DAY),
    ...props,
  })
  Object.assign(result, props)
  return result
}

const authInfo = (role: Role, walletId: string, orgId?: string): AuthInfo =>
  ({ role, walletId, orgId, userId: 'u1', userName: 'user' }) as AuthInfo

describe('AccreditationService', () => {
  let service: AccreditationService
  let em: EntityManager
  let hierarchy: DidHierarchyService
  let statusLists: TokenStatusListService
  let store: Accreditation[]
  let config: ConfigType<typeof AccreditationConfig>

  const makeService = (enabled = true, enforced = true) =>
    new AccreditationService(
      createMock<Agent>({ agencyConfig: { indyEndorserDid: 'did:indy:test:endorser' } }),
      em,
      (() => {
        const logger: Logger = createMock<Logger>()
        vi.mocked(logger.child).mockReturnValue(logger)
        return logger
      })(),
      { ...config, enabled },
      new AuthorizationService({ enabled: enforced }),
      hierarchy,
      statusLists,
    )

  beforeEach(() => {
    store = []
    config = { enabled: true, validityDays: 365, statusListSize: 16, statusListTtl: 300, trustAnchors: [] }
    em = createMock<EntityManager>()
    vi.mocked(em.find).mockImplementation(((_entity: unknown, where: Record<string, string>) =>
      Promise.resolve(
        store.filter((candidate) =>
          Object.entries(where).every(([key, value]) => candidate[key as keyof Accreditation] === value),
        ),
      )) as never)
    hierarchy = createMock<DidHierarchyService>({
      platformDids: vi.fn().mockResolvedValue([PLATFORM]),
      parentDid: vi.fn().mockResolvedValue(ORG),
    })
    statusLists = createMock<TokenStatusListService>({ setStatus: vi.fn() })
    service = makeService()
  })

  describe('check', () => {
    beforeEach(() => {
      store.push(
        accreditation({
          subjectDid: ORG,
          issuerDid: PLATFORM,
          subjectWalletId: 'Organization_org-1',
          issuerWalletId: 'Administration',
          accreditedRole: AccreditedRole.Organization,
        }),
        accreditation({ subjectDid: ISSUER, issuerDid: ORG }),
      )
    })

    test('an issuer with active accreditations up to the platform DID is verified', async () => {
      expect(await service.check([ISSUER])).toEqual({
        verified: true,
        issuers: [{ did: ISSUER, verified: true, trustAnchor: PLATFORM }],
      })
    })

    test('the platform DID itself is a trust anchor', async () => {
      expect((await service.check([PLATFORM])).verified).toBe(true)
    })

    test('configured trust anchors replace the Administration DIDs', async () => {
      config.trustAnchors = ['did:key:other-platform']

      const result = await makeService().check([ISSUER])

      expect(result.verified).toBe(false)
      expect(result.issuers[0].reason).toBe(`${PLATFORM} is not accredited`)
    })

    test('a revoked issuer fails, which also rejects credentials it signed before the revocation', async () => {
      store[1].revokedAt = new Date()

      expect(await service.check([ISSUER])).toEqual({
        verified: false,
        issuers: [{ did: ISSUER, verified: false, reason: `The accreditation of ${ISSUER} is revoked` }],
      })
    })

    test('an offboarded organization breaks the chain of all its issuers', async () => {
      store[0].revokedAt = new Date()

      expect((await service.check([ISSUER])).issuers[0].reason).toBe(`The accreditation of ${ORG} is revoked`)
    })

    test('an expired accreditation fails', async () => {
      store[1].validUntil = new Date(Date.now() - 1000)

      expect((await service.check([ISSUER])).issuers[0].reason).toBe(
        `The accreditation of ${ISSUER} is not valid at this time`,
      )
    })

    test('a reinstated accreditation is enough even after an earlier revocation', async () => {
      store[1].revokedAt = new Date()
      store.push(accreditation({ subjectDid: ISSUER, issuerDid: ORG }))

      expect((await service.check([ISSUER])).verified).toBe(true)
    })

    test('every issuer must pass, and a presentation without issuers does not pass', async () => {
      expect((await service.check([ISSUER, 'did:key:stranger'])).verified).toBe(false)
      expect((await service.check([])).verified).toBe(false)
    })
  })

  describe('revoke', () => {
    beforeEach(() => {
      store.push(
        accreditation({
          subjectDid: ORG,
          issuerDid: PLATFORM,
          subjectWalletId: 'Organization_org-1',
          issuerWalletId: 'Administration',
        }),
        accreditation({ subjectDid: ISSUER, issuerDid: ORG, statusIndex: 7 }),
      )
    })

    test("an OrgAdmin revokes its issuer's accreditation and the status list entry", async () => {
      const result = await service.revoke(authInfo(Role.OrgAdmin, 'Organization_org-1', 'org-1'), { did: ISSUER })

      expect(result).toEqual({ revoked: [ISSUER] })
      expect(statusLists.setStatus).toHaveBeenCalledWith('list-1', 7, TokenStatus.Invalid)
      expect(store[1].revokedAt).toBeInstanceOf(Date)
      expect(store[1].revocationReason).toBe('revoked by the parent')
    })

    test('an OrgAdmin cannot revoke what another wallet accredited', async () => {
      await expect(
        service.revoke(authInfo(Role.OrgAdmin, 'Organization_org-1', 'org-1'), { did: ORG }),
      ).rejects.toThrow(ForbiddenException)
    })

    test('an Admin offboards an organization', async () => {
      const result = await service.revoke(authInfo(Role.Admin, 'Administration'), { orgId: 'org-1' })

      expect(result).toEqual({ revoked: [ORG] })
      expect(store[0].revocationReason).toBe('organization offboarded')
    })

    test('only an Admin offboards an organization', async () => {
      await expect(
        service.revoke(authInfo(Role.OrgAdmin, 'Organization_org-1', 'org-1'), { orgId: 'org-1' }),
      ).rejects.toThrow(ForbiddenException)
    })

    test.each([Role.OrgManager, Role.Issuer, Role.User])('%s cannot revoke', async (role) => {
      await expect(service.revoke(authInfo(role, 'Organization_org-1', 'org-1'), { did: ISSUER })).rejects.toThrow(
        ForbiddenException,
      )
    })

    test('needs exactly one of did and orgId', async () => {
      const admin = authInfo(Role.Admin, 'Administration')
      await expect(service.revoke(admin, {})).rejects.toThrow(BadRequestException)
      await expect(service.revoke(admin, { did: ORG, orgId: 'org-1' })).rejects.toThrow(BadRequestException)
    })

    test('an unknown DID is 404', async () => {
      await expect(service.revoke(authInfo(Role.Admin, 'Administration'), { did: 'did:key:none' })).rejects.toThrow(
        NotFoundException,
      )
    })

    test('revokeWallet revokes every DID of a removed issuer, once', async () => {
      expect(await service.revokeWallet('Issuer_u1_in_Organization_org-1', 'removed')).toEqual([ISSUER])
      expect(await service.revokeWallet('Issuer_u1_in_Organization_org-1', 'removed')).toEqual([])
      expect(statusLists.setStatus).toHaveBeenCalledTimes(1)
    })
  })

  describe('ensureForWallet', () => {
    const issuerAuth = authInfo(Role.Issuer, 'Issuer_u1_in_Organization_org-1', 'org-1')
    let tenantAgent: TenantAgent
    let issue: ReturnType<typeof vi.fn>

    beforeEach(() => {
      tenantAgent = createMock<TenantAgent>({
        dids: { getCreatedDids: vi.fn().mockResolvedValue([didRecordStub({ did: ISSUER })]) },
      })
      issue = vi.fn().mockResolvedValue(accreditation({ subjectDid: ISSUER, issuerDid: ORG }))
      Object.assign(service, { issue })
    })

    test('issues a missing accreditation', async () => {
      await service.ensureForWallet(issuerAuth, tenantAgent)

      expect(issue).toHaveBeenCalledWith({
        did: ISSUER,
        walletId: issuerAuth.walletId,
        orgId: 'org-1',
        accreditedRole: AccreditedRole.Issuer,
        parentWalletId: 'Organization_org-1',
      })
    })

    test('skips the Indy endorser DID shared by every tenant', async () => {
      vi.mocked(tenantAgent.dids.getCreatedDids).mockResolvedValue([didRecordStub({ did: 'did:indy:test:endorser' })])

      await service.ensureForWallet(issuerAuth, tenantAgent)

      expect(issue).not.toHaveBeenCalled()
    })

    test('keeps a current accreditation', async () => {
      store.push(accreditation({ subjectDid: ISSUER, issuerDid: ORG }))

      await service.ensureForWallet(issuerAuth, tenantAgent)

      expect(issue).not.toHaveBeenCalled()
    })

    test('renews one that expires soon or names a previous parent DID', async () => {
      store.push(accreditation({ subjectDid: ISSUER, issuerDid: ORG, validUntil: new Date(Date.now() + DAY) }))
      await service.ensureForWallet(issuerAuth, tenantAgent)
      expect(issue).toHaveBeenCalledTimes(1)

      store.length = 0
      store.push(accreditation({ subjectDid: ISSUER, issuerDid: 'did:key:previous-org-did' }))
      await service.ensureForWallet(issuerAuth, tenantAgent)
      expect(issue).toHaveBeenCalledTimes(2)
    })

    test('does not reinstate a revoked accreditation; only the parent can', async () => {
      store.push(accreditation({ subjectDid: ISSUER, issuerDid: ORG, revokedAt: new Date() }))

      await service.ensureForWallet(issuerAuth, tenantAgent)

      expect(issue).not.toHaveBeenCalled()
    })

    test.each([
      ['disabled', false, true],
      ['used without the role model', true, false],
    ])('does nothing when accreditation is %s', async (_case, enabled, enforced) => {
      service = makeService(enabled, enforced)
      Object.assign(service, { issue })

      expect(await service.ensureForWallet(issuerAuth, tenantAgent)).toEqual([])
      expect(issue).not.toHaveBeenCalled()
    })

    test.each([Role.Admin, Role.Verifier, Role.User])('a %s wallet has no parent to be accredited by', async (role) => {
      await service.ensureForWallet(authInfo(role, 'Some_wallet', 'org-1'), tenantAgent)

      expect(issue).not.toHaveBeenCalled()
    })
  })

  describe('reinstate', () => {
    test('the parent issues a new accreditation for a revoked DID', async () => {
      store.push(accreditation({ subjectDid: ISSUER, issuerDid: ORG, revokedAt: new Date() }))
      const issue = vi.fn().mockResolvedValue(accreditation({ subjectDid: ISSUER, issuerDid: ORG }))
      Object.assign(service, { issue })

      const result = await service.reinstate(authInfo(Role.OrgAdmin, 'Organization_org-1', 'org-1'), ISSUER)

      expect(issue).toHaveBeenCalledWith(expect.objectContaining({ did: ISSUER, parentWalletId: 'Organization_org-1' }))
      expect(result).toMatchObject({ subject: ISSUER, issuer: ORG, state: 'active' })
    })

    test('another wallet cannot reinstate it', async () => {
      store.push(accreditation({ subjectDid: ISSUER, issuerDid: ORG, revokedAt: new Date() }))

      await expect(service.reinstate(authInfo(Role.Admin, 'Administration'), ISSUER)).rejects.toThrow(
        ForbiddenException,
      )
    })
  })

  describe('getChain', () => {
    test('returns the chain child first, with the trust anchor it ends at', async () => {
      store.push(
        accreditation({ subjectDid: ISSUER, issuerDid: ORG }),
        accreditation({ subjectDid: ORG, issuerDid: PLATFORM, accreditedRole: AccreditedRole.Organization }),
      )

      const result = await service.getChain(ISSUER)

      expect(result.trustAnchor).toBe(PLATFORM)
      expect(result.chain.map((entry) => [entry.subject, entry.issuer, entry.state])).toEqual([
        [ISSUER, ORG, 'active'],
        [ORG, PLATFORM, 'active'],
      ])
    })

    test('publishes a revoked accreditation, so the relying party sees the revocation', async () => {
      store.push(accreditation({ subjectDid: ISSUER, issuerDid: ORG, revokedAt: new Date() }))

      const result = await service.getChain(ISSUER)

      expect(result.chain[0].state).toBe('revoked')
      expect(result.trustAnchor).toBeUndefined()
    })

    test('a DID without an accreditation is 404', async () => {
      await expect(service.getChain('did:key:none')).rejects.toThrow(NotFoundException)
    })
  })
})
