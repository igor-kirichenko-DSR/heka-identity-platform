import { JwsService, JwtPayload } from '@credo-ts/core'
import { EntityManager, LockMode } from '@mikro-orm/core'
import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { StatusList } from '@sd-jwt/jwt-status-list'

import { Agent, AGENT_TOKEN, TenantAgent } from 'common/agent'
import { TokenStatusList, Wallet } from 'common/entities'
import AccreditationConfig from 'config/accreditation'
import ExpressConfig from 'config/express'
import { withTenantAgent } from 'utils/multi-tenancy'

/** Status values of a 1-bit list (IETF Token Status List). */
export enum TokenStatus {
  Valid = 0,
  Invalid = 1,
}

const BITS = 1

/** The DID URL of the key a DID signs credentials with: its first assertion method. */
export async function signingDidUrl(tenantAgent: TenantAgent, did: string): Promise<string> {
  const didDocument = await tenantAgent.dids.resolveDidDocument(did)
  const [assertionMethod] = didDocument.assertionMethod ?? []
  const id = typeof assertionMethod === 'string' ? assertionMethod : assertionMethod?.id
  const didUrl = id ?? didDocument.verificationMethod?.[0]?.id
  if (!didUrl) {
    throw new Error(`DID ${did} has no key to sign with`)
  }
  return didUrl.startsWith('#') ? `${did}${didUrl}` : didUrl
}

/**
 * IETF Token Status Lists for SD-JWT VCs, owned by a wallet and signed by one of its DIDs. Credo verifies a status
 * list with the key of the credential's issuer, so every list belongs to exactly one issuer DID.
 */
@Injectable()
export class TokenStatusListService {
  public constructor(
    @Inject(AGENT_TOKEN)
    private readonly agent: Agent,
    private readonly em: EntityManager,
    @Inject(AccreditationConfig.KEY)
    private readonly config: ConfigType<typeof AccreditationConfig>,
    @Inject(ExpressConfig.KEY)
    private readonly appConfig: ConfigType<typeof ExpressConfig>,
  ) {}

  public uri(id: string): string {
    return `${this.appConfig.appEndpoint}/accreditations/status-lists/${id}`
  }

  /** Reserves the next free entry, in a list of the wallet's issuer DID with room left or a new one. */
  public async allocate(walletId: string, issuerDid: string): Promise<{ list: TokenStatusList; index: number }> {
    return await this.em.transactional(async (em) => {
      const lists = await em.find(
        TokenStatusList,
        { walletId, issuerDid },
        { lockMode: LockMode.PESSIMISTIC_WRITE, orderBy: { lastIndex: 'asc' } },
      )
      let list = lists.find((candidate) => candidate.lastIndex < candidate.size)
      if (!list) {
        const size = this.config.statusListSize
        list = new TokenStatusList({
          walletId,
          issuerDid,
          size,
          list: new StatusList(new Array<number>(size).fill(TokenStatus.Valid), BITS).compressStatusList(),
        })
        em.persist(list)
      }
      const index = list.lastIndex
      list.lastIndex += 1
      return { list, index }
    })
  }

  public async setStatus(listId: string, index: number, status: TokenStatus): Promise<void> {
    await this.em.transactional(async (em) => {
      const list = await em.findOneOrFail(TokenStatusList, { id: listId }, { lockMode: LockMode.PESSIMISTIC_WRITE })
      const statusList = StatusList.decompressStatusList(list.list, BITS)
      statusList.setStatus(index, status)
      list.list = statusList.compressStatusList()
    })
  }

  public async getStatus(listId: string, index: number): Promise<TokenStatus> {
    const list = await this.em.findOneOrFail(TokenStatusList, { id: listId }, { refresh: true })
    return StatusList.decompressStatusList(list.list, BITS).getStatus(index)
  }

  /** The list as a `statuslist+jwt`, signed by the list's issuer DID, valid for the configured TTL. */
  public async signedList(id: string): Promise<string> {
    const list = await this.em.findOne(TokenStatusList, { id }, { refresh: true })
    if (!list) {
      throw new NotFoundException(`Status list ${id} not found`)
    }
    const wallet = await this.em.findOneOrFail(Wallet, { id: list.walletId })

    return await withTenantAgent({ agent: this.agent, tenantId: wallet.tenantId }, async (tenantAgent) => {
      const didUrl = await signingDidUrl(tenantAgent, list.issuerDid)
      const { publicJwk } = await tenantAgent.dids.resolveVerificationMethodFromCreatedDidRecord(didUrl)
      const iat = Math.floor(Date.now() / 1000)
      const ttl = this.config.statusListTtl
      return await tenantAgent.context.resolve(JwsService).createJwsCompact(tenantAgent.context, {
        keyId: publicJwk.keyId,
        payload: new JwtPayload({
          iss: list.issuerDid,
          sub: this.uri(list.id),
          iat,
          exp: iat + ttl,
          additionalClaims: { ttl, status_list: { bits: BITS, lst: list.list } },
        }),
        protectedHeaderOptions: { alg: publicJwk.signatureAlgorithm, kid: didUrl, typ: 'statuslist+jwt' },
      })
    })
  }
}
