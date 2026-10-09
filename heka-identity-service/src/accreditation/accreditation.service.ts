import { parseDid } from '@credo-ts/core'
import { EntityManager } from '@mikro-orm/core'
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'

import { Agent, AGENT_TOKEN, TenantAgent } from 'common/agent'
import { AuthInfo, Role } from 'common/auth'
import { AuthorizationService } from 'common/authz'
import { DidHierarchyService } from 'common/did-hierarchy'
import { Accreditation, AccreditedRole, TokenStatusList, Wallet } from 'common/entities'
import { InjectLogger, Logger } from 'common/logger'
import AccreditationConfig from 'config/accreditation'
import { ADMINISTRATION_WALLET_ID, getOrganizationWalletId } from 'utils/auth'
import { withTenantAgent } from 'utils/multi-tenancy'

import {
  AccreditationChainDto,
  AccreditationChainEntryDto,
  AccreditationCheckDto,
  AccreditationDto,
  AccreditationState,
  RevokeAccreditationsRequestDto,
  RevokeAccreditationsResponseDto,
} from './dto'
import { signingDidUrl, TokenStatus, TokenStatusListService } from './token-status-list.service'

/** `vct` of an accreditation credential. */
export const ACCREDITATION_VCT = 'urn:heka:vct:accreditation:1'

/** Platform -> organization -> issuer: a chain never needs more links than this. */
const MAX_CHAIN_LENGTH = 3

const DAY_MS = 24 * 60 * 60 * 1000

interface Subject {
  did: string
  walletId: string
  orgId: string
  accreditedRole: AccreditedRole
  parentWalletId: string
}

/**
 * Accreditation credentials (phase 7 of docs/role-model-and-oidc-providers.md). The parent wallet signs an
 * SD-JWT VC for each public DID of its child: `Administration` for an organization, the organization for an issuer.
 * Each one carries an entry in a Token Status List of the parent, so revoking it makes verifiers that check the chain
 * reject everything the child signed, including credentials issued before.
 *
 * Heka keeps the credentials and serves them at `GET /accreditations/:did`; its own verification sessions check the
 * chain against this database, which is the issuer's own record.
 */
@Injectable()
export class AccreditationService {
  public constructor(
    @Inject(AGENT_TOKEN)
    private readonly agent: Agent,
    private readonly em: EntityManager,
    @InjectLogger(AccreditationService)
    private readonly logger: Logger,
    @Inject(AccreditationConfig.KEY)
    private readonly config: ConfigType<typeof AccreditationConfig>,
    private readonly authorizationService: AuthorizationService,
    private readonly hierarchy: DidHierarchyService,
    private readonly statusLists: TokenStatusListService,
  ) {}

  /** Accreditations are issued only with the hierarchy in place, i.e. with the role model enforced. */
  public get isIssuing(): boolean {
    return this.config.enabled && this.authorizationService.isEnforced
  }

  /** Accredits a DID the caller has just created. Returns `undefined` when there is nothing to accredit (yet). */
  public async accreditNewDid(authInfo: AuthInfo, did: string): Promise<Accreditation | undefined> {
    const subject = this.subjectFor(authInfo, did)
    if (!this.isIssuing || !subject) {
      return undefined
    }
    return await this.issue(subject)
  }

  /**
   * Makes sure every DID of the caller's wallet has a current accreditation: issues missing ones (for example when the
   * parent wallet had no DID yet), renews ones that expire soon or name a previous parent DID. DIDs whose
   * accreditation was revoked are left alone: only the parent can reinstate them.
   */
  public async ensureForWallet(authInfo: AuthInfo, tenantAgent: TenantAgent): Promise<Accreditation[]> {
    const logger = this.logger.child('ensureForWallet', { walletId: authInfo.walletId })
    if (!this.isIssuing || !DidHierarchyService.parentOf(authInfo)) {
      return []
    }

    const issued: Accreditation[] = []
    const now = new Date()
    const renewBefore = new Date(now.getTime() + (this.config.validityDays * DAY_MS) / 10)
    for (const { did } of await tenantAgent.dids.getCreatedDids({})) {
      // The Indy endorser DID is shared by every tenant; it isn't the wallet's own DID
      const subject = did !== this.agent.agencyConfig.indyEndorserDid && this.subjectFor(authInfo, did)
      if (!subject) continue

      const accreditations = await this.em.find(Accreditation, { subjectDid: did })
      const active = accreditations.filter((accreditation) => accreditation.isActive(now))
      if (!active.length && accreditations.some((accreditation) => accreditation.revokedAt)) {
        logger.info(`The accreditation of ${did} is revoked; skipped`)
        continue
      }
      const parentDid = await this.hierarchy.parentDid(subject.parentWalletId, parseDid(did).method)
      const current = active.some(
        (accreditation) => accreditation.issuerDid === parentDid && accreditation.validUntil > renewBefore,
      )
      if (current) continue

      const accreditation = await this.issue(subject)
      if (accreditation) issued.push(accreditation)
    }
    return issued
  }

  /**
   * Revokes accreditations the caller's wallet issued: those of one DID, or (`Admin` offboarding an organization)
   * those of every DID of the organization.
   */
  public async revoke(
    authInfo: AuthInfo,
    req: RevokeAccreditationsRequestDto,
  ): Promise<RevokeAccreditationsResponseDto> {
    this.assertParentRole(authInfo)
    if (Boolean(req.did) === Boolean(req.orgId)) {
      throw new BadRequestException('Set either did or orgId')
    }

    let accreditations: Accreditation[]
    if (req.did) {
      accreditations = await this.em.find(Accreditation, { subjectDid: req.did })
      if (!accreditations.length) {
        throw new NotFoundException(`No accreditation for ${req.did}`)
      }
      if (accreditations.some((accreditation) => accreditation.issuerWalletId !== authInfo.walletId)) {
        throw new ForbiddenException(`${req.did} is not accredited by your wallet`)
      }
    } else {
      if (authInfo.role !== Role.Admin) {
        throw new ForbiddenException('Only an Admin can offboard an organization')
      }
      accreditations = await this.em.find(Accreditation, {
        subjectWalletId: getOrganizationWalletId(req.orgId!),
        issuerWalletId: ADMINISTRATION_WALLET_ID,
      })
    }

    const reason = req.reason ?? (req.orgId ? 'organization offboarded' : 'revoked by the parent')
    const revoked = await this.revokeAll(accreditations, reason)
    this.logger
      .child('revoke')
      .info(
        { audit: 'accreditation-revoked', actor: authInfo.userId, did: req.did, orgId: req.orgId, reason, revoked },
        `${authInfo.userName} revoked ${revoked.length} accreditation(s)`,
      )
    return { revoked }
  }

  /** Revokes the accreditations of every DID of a wallet, e.g. when its issuer loses the `Issuer` role. */
  public async revokeWallet(walletId: string, reason: string): Promise<string[]> {
    if (!this.config.enabled) {
      return []
    }
    const revoked = await this.revokeAll(await this.em.find(Accreditation, { subjectWalletId: walletId }), reason)
    if (revoked.length) {
      this.logger
        .child('revokeWallet')
        .info(
          { audit: 'accreditation-revoked', walletId, reason, revoked },
          `Revoked the accreditations of ${walletId}: ${reason}`,
        )
    }
    return revoked
  }

  /** Issues a new accreditation for a DID whose accreditation the caller's wallet revoked. */
  public async reinstate(authInfo: AuthInfo, did: string): Promise<AccreditationDto> {
    this.assertParentRole(authInfo)
    if (!this.isIssuing) {
      throw new BadRequestException('Accreditation is not enabled')
    }
    const [previous] = await this.em.find(Accreditation, { subjectDid: did }, { orderBy: { validFrom: 'desc' } })
    if (!previous) {
      throw new NotFoundException(`No accreditation for ${did}`)
    }
    if (previous.issuerWalletId !== authInfo.walletId) {
      throw new ForbiddenException(`${did} is not accredited by your wallet`)
    }
    const accreditation = await this.issue({
      did,
      walletId: previous.subjectWalletId,
      orgId: previous.orgId,
      accreditedRole: previous.accreditedRole,
      parentWalletId: previous.issuerWalletId,
    })
    if (!accreditation) {
      throw new BadRequestException(`Your wallet has no DID to accredit ${did} with`)
    }
    this.logger
      .child('reinstate')
      .info(
        { audit: 'accreditation-reinstated', actor: authInfo.userId, did },
        `${authInfo.userName} reinstated the accreditation of ${did}`,
      )
    return AccreditationDto.from(accreditation, AccreditationState.Active)
  }

  /**
   * The published chain of a DID, child first: at each level the active accreditation, or the latest one when none is
   * active, so a relying party sees a revocation in the status list itself.
   */
  public async getChain(did: string): Promise<AccreditationChainDto> {
    const anchors = await this.trustAnchors()
    const chain: AccreditationChainEntryDto[] = []
    let current = did
    const now = new Date()
    while (!anchors.has(current) && chain.length < MAX_CHAIN_LENGTH) {
      const accreditations = await this.em.find(
        Accreditation,
        { subjectDid: current },
        { orderBy: { validFrom: 'desc' } },
      )
      const accreditation = accreditations.find((candidate) => candidate.isActive(now)) ?? accreditations[0]
      if (!accreditation) break
      chain.push(AccreditationDto.from(accreditation, AccreditationService.state(accreditation, now)))
      current = accreditation.issuerDid
    }
    if (!chain.length && !anchors.has(did)) {
      throw new NotFoundException(`No accreditation for ${did}`)
    }
    return { did, trustAnchor: anchors.has(current) ? current : undefined, chain }
  }

  /** Whether each DID has an unbroken chain of active accreditations up to a trust anchor. */
  public async check(dids: string[]): Promise<AccreditationCheckDto> {
    const anchors = await this.trustAnchors()
    const now = new Date()
    const issuers = await Promise.all(
      [...new Set(dids)].map(async (did) => {
        let current = did
        for (let length = 0; length <= MAX_CHAIN_LENGTH; length++) {
          if (anchors.has(current)) {
            return { did, verified: true, trustAnchor: current }
          }
          const accreditations = await this.em.find(Accreditation, { subjectDid: current })
          const active = accreditations.find((accreditation) => accreditation.isActive(now))
          if (!active) {
            const reason = !accreditations.length
              ? `${current} is not accredited`
              : accreditations.some((accreditation) => accreditation.revokedAt)
                ? `The accreditation of ${current} is revoked`
                : `The accreditation of ${current} is not valid at this time`
            return { did, verified: false, reason }
          }
          current = active.issuerDid
        }
        return { did, verified: false, reason: `The chain of ${did} is too long` }
      }),
    )
    return { verified: issuers.length > 0 && issuers.every((issuer) => issuer.verified), issuers }
  }

  public async trustAnchors(): Promise<Set<string>> {
    return new Set(this.config.trustAnchors.length ? this.config.trustAnchors : await this.hierarchy.platformDids())
  }

  private static state(accreditation: Accreditation, now: Date): AccreditationState {
    if (accreditation.revokedAt) return AccreditationState.Revoked
    if (now < accreditation.validFrom) return AccreditationState.NotYetValid
    if (now >= accreditation.validUntil) return AccreditationState.Expired
    return AccreditationState.Active
  }

  private subjectFor(authInfo: AuthInfo, did: string): Subject | null {
    const parent = DidHierarchyService.parentOf(authInfo)
    if (!parent || !authInfo.orgId) return null
    return {
      did,
      walletId: authInfo.walletId,
      orgId: authInfo.orgId,
      accreditedRole: parent.accreditedRole,
      parentWalletId: parent.walletId,
    }
  }

  private assertParentRole(authInfo: AuthInfo): void {
    if (authInfo.role !== Role.Admin && authInfo.role !== Role.OrgAdmin) {
      throw new ForbiddenException('Only an Admin or an OrgAdmin can manage accreditations')
    }
  }

  private async issue(subject: Subject): Promise<Accreditation | undefined> {
    const logger = this.logger.child('issue', { did: subject.did })
    const parentWallet = await this.em.findOne(Wallet, { id: subject.parentWalletId })
    const issuerDid = parentWallet && (await this.hierarchy.parentDid(parentWallet.id, parseDid(subject.did).method))
    if (!parentWallet || !issuerDid) {
      logger.info(`${subject.parentWalletId} has no DID yet; ${subject.did} is accredited on a later prepare-wallet`)
      return undefined
    }

    const validFrom = new Date()
    const validUntil = new Date(validFrom.getTime() + this.config.validityDays * DAY_MS)
    const { list, index } = await this.statusLists.allocate(parentWallet.id, issuerDid)

    const credential = await withTenantAgent(
      { agent: this.agent, tenantId: parentWallet.tenantId },
      async (tenantAgent) => {
        const { compact } = await tenantAgent.sdJwtVc.sign({
          payload: {
            vct: ACCREDITATION_VCT,
            sub: subject.did,
            org_id: subject.orgId,
            role: subject.accreditedRole,
            nbf: Math.floor(validFrom.getTime() / 1000),
            exp: Math.floor(validUntil.getTime() / 1000),
            status: { status_list: { idx: index, uri: this.statusLists.uri(list.id) } },
          },
          issuer: { method: 'did', didUrl: await signingDidUrl(tenantAgent, issuerDid) },
        })
        return compact
      },
    )

    const accreditation = new Accreditation({
      subjectDid: subject.did,
      subjectWalletId: subject.walletId,
      issuerDid,
      issuerWalletId: parentWallet.id,
      orgId: subject.orgId,
      accreditedRole: subject.accreditedRole,
      credential,
      statusList: this.em.getReference(TokenStatusList, list.id),
      statusIndex: index,
      validFrom,
      validUntil,
    })
    this.em.persist(accreditation)
    await this.em.flush()
    logger.info(`${issuerDid} accredited ${subject.did} as ${subject.accreditedRole} of ${subject.orgId}`)
    return accreditation
  }

  private async revokeAll(accreditations: Accreditation[], reason: string): Promise<string[]> {
    const revoked = new Set<string>()
    for (const accreditation of accreditations) {
      if (accreditation.revokedAt) continue
      await this.statusLists.setStatus(accreditation.statusList.id, accreditation.statusIndex, TokenStatus.Invalid)
      accreditation.revokedAt = new Date()
      accreditation.revocationReason = reason
      revoked.add(accreditation.subjectDid)
    }
    await this.em.flush()
    return [...revoked]
  }
}
