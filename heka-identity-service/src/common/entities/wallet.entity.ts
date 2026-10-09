import { Collection } from '@mikro-orm/core'
import { Entity, Index, ManyToMany, Property } from '@mikro-orm/decorators/legacy'

import { Identified } from './identified.entity'
import { User } from './user.entity'

@Entity()
export class Wallet extends Identified {
  @Index()
  @Property({ type: 'string' })
  public tenantId: string

  @Index()
  @Property({ nullable: true, type: 'string' })
  public publicDid?: string

  /**
   * The DID of each method that acts for this wallet as the parent of its children's DIDs: their `controller` and
   * the issuer of their accreditations. It is the first DID the wallet created with that method, so it stays the
   * same when more DIDs are created.
   */
  @Property({ type: 'json', nullable: true })
  public designatedDids?: Record<string, string>

  @ManyToMany({ entity: () => User, mappedBy: 'wallets' })
  public users = new Collection<User>(this)

  public constructor(props: Omit<Wallet, 'users'>) {
    super(props)
    this.tenantId = props.tenantId
  }
}
