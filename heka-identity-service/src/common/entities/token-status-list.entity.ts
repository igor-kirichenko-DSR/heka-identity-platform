import { Entity, Index, Property } from '@mikro-orm/decorators/legacy'

import { Identified } from './identified.entity'

interface TokenStatusListProps {
  id?: string
  walletId: string
  issuerDid: string
  size: number
  list: string
}

/**
 * An IETF Token Status List (1 bit per entry: 0 valid, 1 invalid) owned by a wallet and published as a
 * `statuslist+jwt` signed by `issuerDid`. SD-JWT VC verifiers check the list with the key of the credential issuer,
 * so a wallet has one list per DID it issues with.
 */
@Entity()
export class TokenStatusList extends Identified {
  @Index()
  @Property({ type: 'string' })
  public walletId: string

  @Index()
  @Property({ type: 'string' })
  public issuerDid: string

  @Property({ type: 'number' })
  public size: number

  @Property({ type: 'number' })
  public lastIndex: number

  /** The `lst` value: the compressed, base64url-encoded list. */
  @Property({ type: 'text' })
  public list: string

  public constructor(props: TokenStatusListProps) {
    super(props)
    this.walletId = props.walletId
    this.issuerDid = props.issuerDid
    this.size = props.size
    this.lastIndex = 0
    this.list = props.list
  }
}
