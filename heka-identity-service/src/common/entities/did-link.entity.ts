import { Entity, Index, Property, Unique } from '@mikro-orm/decorators/legacy'

import { Identified } from './identified.entity'

interface DidLinkProps {
  id?: string
  did: string
  method: string
  walletId: string
  role: string
  orgId?: string
  parentWalletId: string
  parentDid?: string
  controllerDeclared: boolean
  createdAt?: Date
}

/**
 * The parent of a public DID created by an `OrgAdmin` or an `Issuer` with the role model enabled: the wallet one
 * level up and its designated DID at creation time. Ledgers don't record this link (a `controller` is declared by
 * the child itself), so Heka keeps it for audit, for accreditation and for re-syncing.
 */
@Entity()
export class DidLink extends Identified {
  @Unique()
  @Property({ type: 'string' })
  public did: string

  @Property({ type: 'string' })
  public method: string

  @Index()
  @Property({ type: 'string' })
  public walletId: string

  /** Role of the creator, which decides the parent wallet. */
  @Property({ type: 'string' })
  public role: string

  @Property({ type: 'string', nullable: true })
  public orgId?: string

  @Index()
  @Property({ type: 'string' })
  public parentWalletId: string

  /** Unset when the parent wallet had no DID yet; accreditation then waits for the next `POST /prepare-wallet`. */
  @Property({ type: 'string', nullable: true })
  public parentDid?: string

  /** Whether `parentDid` was written to the ledger as the DID's `controller` (`hedera` only). */
  @Property({ type: 'boolean' })
  public controllerDeclared: boolean

  @Property({ type: 'timestamp' })
  public createdAt: Date

  public constructor(props: DidLinkProps) {
    super(props)
    this.did = props.did
    this.method = props.method
    this.walletId = props.walletId
    this.role = props.role
    this.orgId = props.orgId
    this.parentWalletId = props.parentWalletId
    this.parentDid = props.parentDid
    this.controllerDeclared = props.controllerDeclared
    this.createdAt = props.createdAt ?? new Date()
  }
}
