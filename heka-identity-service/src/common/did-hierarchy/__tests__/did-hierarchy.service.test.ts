import { createMock } from '@golevelup/ts-vitest'
import { EntityManager } from '@mikro-orm/core'

import { Agent, TenantAgent } from 'common/agent'
import { Role } from 'common/auth'
import { AccreditedRole, Wallet } from 'common/entities'
import { Logger } from 'common/logger'

import { didRecordStub, entityStub } from '../../../../test/helpers/mock-records'
import { DidHierarchyService } from '../did-hierarchy.service'

describe('DidHierarchyService', () => {
  let service: DidHierarchyService
  let agent: Agent
  let em: EntityManager
  let tenantAgent: TenantAgent
  let wallets: Map<string, Wallet>

  beforeEach(() => {
    wallets = new Map()
    tenantAgent = createMock<TenantAgent>({ dids: { getCreatedDids: vi.fn().mockResolvedValue([]) } })
    agent = createMock<Agent>()
    Object.assign(agent, {
      modules: {
        tenants: {
          withTenantAgent: vi.fn(async (_options: unknown, callback: (tenantAgent: TenantAgent) => Promise<void>) => {
            await callback(tenantAgent)
          }),
        },
      },
    })
    em = createMock<EntityManager>()
    vi.mocked(em.findOne).mockImplementation(((_entity: unknown, where: { id: string }) =>
      Promise.resolve(wallets.get(where.id) ?? null)) as never)
    const logger: Logger = createMock<Logger>()
    vi.mocked(logger.child).mockReturnValue(logger)
    service = new DidHierarchyService(agent, em, logger)
  })

  const addWallet = (props: Partial<Wallet> & { id: string }) => {
    const wallet = entityStub<Wallet>({ tenantId: `tenant-${props.id}`, ...props })
    wallets.set(props.id, wallet)
    return wallet
  }

  describe('parentOf', () => {
    test.each([
      [Role.OrgAdmin, 'Administration', AccreditedRole.Organization],
      [Role.OrgManager, 'Administration', AccreditedRole.Organization],
      [Role.OrgMember, 'Administration', AccreditedRole.Organization],
      [Role.Issuer, 'Organization_org-1', AccreditedRole.Issuer],
    ])('%s acts in a wallet whose parent is %s', (role, walletId, accreditedRole) => {
      expect(DidHierarchyService.parentOf({ role, orgId: 'org-1' })).toEqual({ walletId, accreditedRole })
    })

    test.each([Role.Admin, Role.Verifier, Role.User])('%s has no parent', (role) => {
      expect(DidHierarchyService.parentOf({ role, orgId: 'org-1' })).toBeNull()
    })
  })

  describe('designatedDid', () => {
    test('returns the stored designated DID without looking at the wallet DIDs', async () => {
      addWallet({ id: 'Administration', designatedDids: { hedera: 'did:hedera:designated' } })

      expect(await service.designatedDid('Administration', 'hedera')).toBe('did:hedera:designated')
      expect(tenantAgent.dids.getCreatedDids).not.toHaveBeenCalled()
    })

    test('designates the oldest DID of the method and stores it, so later DIDs do not change it', async () => {
      const wallet = addWallet({ id: 'Administration', designatedDids: { key: 'did:key:main' } })
      vi.mocked(tenantAgent.dids.getCreatedDids).mockResolvedValue([
        didRecordStub({ did: 'did:hedera:newer', createdAt: new Date('2026-02-01') }),
        didRecordStub({ did: 'did:hedera:older', createdAt: new Date('2026-01-01') }),
      ])

      expect(await service.designatedDid('Administration', 'hedera')).toBe('did:hedera:older')
      expect(tenantAgent.dids.getCreatedDids).toHaveBeenCalledWith({ method: 'hedera' })
      expect(wallet.designatedDids).toEqual({ key: 'did:key:main', hedera: 'did:hedera:older' })
      expect(em.flush).toHaveBeenCalled()
    })

    test('is undefined for an unknown wallet or a wallet without a DID of the method', async () => {
      addWallet({ id: 'Administration' })

      expect(await service.designatedDid('Organization_none', 'key')).toBeUndefined()
      expect(await service.designatedDid('Administration', 'key')).toBeUndefined()
    })
  })

  test('parentDid falls back to the main DID when the parent has no DID of the method', async () => {
    addWallet({ id: 'Organization_org-1', publicDid: 'did:key:org' })

    expect(await service.parentDid('Organization_org-1', 'indy')).toBe('did:key:org')
  })

  test('platformDids are the designated and main DIDs of Administration', async () => {
    addWallet({
      id: 'Administration',
      publicDid: 'did:key:platform',
      designatedDids: { key: 'did:key:platform', hedera: 'did:hedera:platform' },
    })

    expect(await service.platformDids()).toEqual(['did:key:platform', 'did:hedera:platform'])
  })
})
