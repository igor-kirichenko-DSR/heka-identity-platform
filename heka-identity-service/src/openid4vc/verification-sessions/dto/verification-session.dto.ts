import type { OpenId4VcVerificationSessionRecord } from '@credo-ts/openid4vc'

import { OpenId4VcVerificationSessionState } from '@credo-ts/openid4vc'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'

import { OpenId4VcSiopAuthorizationResponsePayload } from './authorization-response-payload.dto'

/**
 * @example "821f9b26-ad04-4f56-89b6-e2ef9c72b36e"
 */
export type RecordId = string

/** The attributes a single presentation disclosed, by claim name. */
export type DisclosedAttributes = Record<string, unknown>

/** What a verified authorization response disclosed, as resolved from its presentations. */
export interface SharedAttributes {
  sharedAttributes?: DisclosedAttributes
  sharedAttributesByCredentialQuery?: Record<string, DisclosedAttributes[]>
}

export class OpenId4VcVerificationSessionRecordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  public id!: RecordId

  @ApiProperty()
  @IsDate()
  public createdAt!: Date

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  public updatedAt?: Date

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  public type!: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  public publicVerifierId!: string

  /**
   * The state of the verification session.
   */
  @ApiProperty()
  @IsEnum(OpenId4VcVerificationSessionState)
  public state!: OpenId4VcVerificationSessionState

  /**
   * Optional error message of the error that occurred during the verification session. Will be set when state is {@link OpenId4VcVerificationSessionState.Error}
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public errorMessage?: string

  /**
   * The signed JWT containing the authorization request
   */
  @ApiProperty()
  @IsOptional()
  @IsString()
  public authorizationRequestJwt?: string

  /**
   * URI of the authorization request. This is the url that can be used to
   * retrieve the authorization request
   */
  @ApiProperty()
  @IsOptional()
  @IsString()
  public authorizationRequestUri?: string

  /**
   * The payload of the received authorization response
   */
  @ApiPropertyOptional()
  @IsOptional()
  public authorizationResponsePayload?: OpenId4VcSiopAuthorizationResponsePayload

  /**
   * The attributes disclosed by the response, flattened across every presentation it carried.
   * A claim name disclosed by more than one credential keeps the value of the last presentation:
   * read {@link sharedAttributesByCredentialQuery} when more than one credential was requested.
   */
  @ApiPropertyOptional()
  @IsOptional()
  public sharedAttributes?: DisclosedAttributes

  /**
   * DCQL responses only: the disclosed attributes of every presentation, keyed by the credential
   * query id it answers. Each entry is an array — the DCQL `multiple` feature lets a wallet return
   * several presentations for one query.
   */
  @ApiPropertyOptional()
  @IsOptional()
  public sharedAttributesByCredentialQuery?: Record<string, DisclosedAttributes[]>

  public constructor(params: OpenId4VcVerificationSessionRecordDto) {
    this.id = params.id
    this.createdAt = params.createdAt
    this.updatedAt = params.updatedAt
    this.type = params.type
    this.publicVerifierId = params.publicVerifierId
    this.state = params.state
    this.errorMessage = params.errorMessage
    this.authorizationRequestJwt = params.authorizationRequestJwt
    this.authorizationRequestUri = params.authorizationRequestUri
    this.authorizationResponsePayload = params.authorizationResponsePayload
    this.sharedAttributes = params.sharedAttributes
    this.sharedAttributesByCredentialQuery = params.sharedAttributesByCredentialQuery
  }

  public static fromOpenId4VcVerificationSessionRecord(
    record: OpenId4VcVerificationSessionRecord,
    shared: SharedAttributes = {},
  ): OpenId4VcVerificationSessionRecordDto {
    return new OpenId4VcVerificationSessionRecordDto({
      ...record,
      publicVerifierId: record.verifierId,
      authorizationResponsePayload: record.authorizationResponsePayload,
      sharedAttributes: shared.sharedAttributes,
      sharedAttributesByCredentialQuery: shared.sharedAttributesByCredentialQuery,
    })
  }
}
