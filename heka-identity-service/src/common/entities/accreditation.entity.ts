import { Entity, Enum, Index, ManyToOne, Property } from '@mikro-orm/decorators/legacy'

import { Identified } from './identified.entity'
import { TokenStatusList } from './token-status-list.entity'

/** What the parent accredits the child DID as. */
export enum AccreditedRole {
  Organization = 'Organization',
  Issuer = 'Issuer',
}

interface AccreditationProps {
  id?: string
  subjectDid: string
  subjectWalletId: string
  issuerDid: string
  issuerWalletId: string
  orgId: string
  accreditedRole: AccreditedRole
  credential: string
  statusList: TokenStatusList
  statusIndex: number
  validFrom: Date
  validUntil: Date
}

/** An accreditation credential (SD-JWT VC) the parent wallet issued for a child DID. */
@Entity()
export class Accreditation extends Identified {
  @Index()
  @Property({ type: 'string' })
  public subjectDid: string

  @Index()
  @Property({ type: 'string' })
  public subjectWalletId: string

  @Property({ type: 'string' })
  public issuerDid: string

  @Index()
  @Property({ type: 'string' })
  public issuerWalletId: string

  @Property({ type: 'string' })
  public orgId: string

  @Property({ type: 'string' })
  @Enum(() => AccreditedRole)
  public accreditedRole: AccreditedRole

  /** The compact SD-JWT VC. */
  @Property({ type: 'text' })
  public credential: string

  @ManyToOne(() => TokenStatusList)
  public statusList: TokenStatusList

  @Property({ type: 'number' })
  public statusIndex: number

  @Property({ type: 'timestamp' })
  public validFrom: Date

  @Property({ type: 'timestamp' })
  public validUntil: Date

  @Property({ type: 'timestamp', nullable: true })
  public revokedAt?: Date

  @Property({ type: 'string', nullable: true })
  public revocationReason?: string

  public constructor(props: AccreditationProps) {
    super(props)
    this.subjectDid = props.subjectDid
    this.subjectWalletId = props.subjectWalletId
    this.issuerDid = props.issuerDid
    this.issuerWalletId = props.issuerWalletId
    this.orgId = props.orgId
    this.accreditedRole = props.accreditedRole
    this.credential = props.credential
    this.statusList = props.statusList
    this.statusIndex = props.statusIndex
    this.validFrom = props.validFrom
    this.validUntil = props.validUntil
  }

  public isActive(now: Date = new Date()): boolean {
    return !this.revokedAt && this.validFrom <= now && now < this.validUntil
  }
}
