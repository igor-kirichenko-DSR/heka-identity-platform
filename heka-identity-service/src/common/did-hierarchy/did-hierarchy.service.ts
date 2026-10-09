import { EntityManager } from '@mikro-orm/core'
import { Inject, Injectable } from '@nestjs/common'

import { Agent, AGENT_TOKEN } from 'common/agent'
import { Role } from 'common/auth'
import { AccreditedRole, DidLink, Wallet } from 'common/entities'
import { InjectLogger, Logger } from 'common/logger'
import { ADMINISTRATION_WALLET_ID, getOrganizationWalletId } from 'utils/auth'
import { withTenantAgent } from 'utils/multi-tenancy'

/** The wallet one level up from a role's wallet, and what it vouches for, or `null` at the top and outside. */
export interface DidParent {
  walletId: string
  accreditedRole: AccreditedRole
}

/**
 * The platform -> organization -> issuer hierarchy of public DIDs (phase 9.2 and 9.3):
 * - every wallet has one designated DID per method that its children name as parent;
 * - every DID an `OrgAdmin` or `Issuer` creates is recorded with its parent.
 */
@Injectable()
export class DidHierarchyService {
  public constructor(
    @Inject(AGENT_TOKEN)
    private readonly agent: Agent,
    private readonly em: EntityManager,
    @InjectLogger(DidHierarchyService)
    private readonly logger: Logger,
  ) {}

  /**
   * The parent of the wallet a role acts in: `Administration` for the organization wallet, the organization for an
   * issuer. Every organization role acts in the organization wallet, so they all share its parent.
   */
  public static parentOf({ role, orgId }: { role: Role; orgId?: string }): DidParent | null {
    switch (role) {
      case Role.OrgAdmin:
      case Role.OrgManager:
      case Role.OrgMember:
        return orgId ? { walletId: ADMINISTRATION_WALLET_ID, accreditedRole: AccreditedRole.Organization } : null
      case Role.Issuer:
        return orgId ? { walletId: getOrganizationWalletId(orgId), accreditedRole: AccreditedRole.Issuer } : null
      default:
        return null
    }
  }

  /**
   * The wallet's designated DID for a method: the stored one, otherwise its oldest DID of that method, which is then
   * stored so it doesn't change when more DIDs are created. `undefined` when the wallet has no DID of that method.
   */
  public async designatedDid(walletId: string, method: string): Promise<string | undefined> {
    const wallet = await this.em.findOne(Wallet, { id: walletId })
    if (!wallet) {
      return undefined
    }
    const stored = wallet.designatedDids?.[method]
    if (stored) {
      return stored
    }

    const didRecords = await withTenantAgent({ agent: this.agent, tenantId: wallet.tenantId }, (tenantAgent) =>
      tenantAgent.dids.getCreatedDids({ method }),
    )
    const oldest = [...didRecords].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
    if (!oldest) {
      return undefined
    }

    wallet.designatedDids = { ...wallet.designatedDids, [method]: oldest.did }
    await this.em.flush()
    this.logger.child('designatedDid').info(`Designated ${oldest.did} as the ${method} DID of ${walletId}`)
    return oldest.did
  }

  /** The DID a parent wallet vouches for a child DID with: its designated DID of that method, else its main DID. */
  public async parentDid(parentWalletId: string, method: string): Promise<string | undefined> {
    const designated = await this.designatedDid(parentWalletId, method)
    if (designated) {
      return designated
    }
    const wallet = await this.em.findOne(Wallet, { id: parentWalletId })
    return wallet?.publicDid
  }

  /** The DIDs that are at the top of the hierarchy: those of the `Administration` wallet. */
  public async platformDids(): Promise<string[]> {
    const wallet = await this.em.findOne(Wallet, { id: ADMINISTRATION_WALLET_ID })
    if (!wallet) {
      return []
    }
    return [
      ...new Set([...Object.values(wallet.designatedDids ?? {}), ...(wallet.publicDid ? [wallet.publicDid] : [])]),
    ]
  }

  public async recordLink(props: ConstructorParameters<typeof DidLink>[0]): Promise<DidLink> {
    const link = new DidLink(props)
    this.em.persist(link)
    await this.em.flush()
    return link
  }
}
