import type { OpenId4VcVerificationSessionRecord } from '@credo-ts/openid4vc'

import { OpenId4VcVerificationSessionState } from '@credo-ts/openid4vc'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'

import { AccreditationCheckDto } from 'accreditation/dto'

import { OpenId4VcSiopAuthorizationResponsePayload } from './authorization-response-payload.dto'

/**
 * @example "821f9b26-ad04-4f56-89b6-e2ef9c72b36e"
 */
export type RecordId = string

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

  @ApiPropertyOptional()
  @IsOptional()
  public sharedAttributes?: Record<string, unknown>

  @ApiPropertyOptional({
    type: AccreditationCheckDto,
    description:
      'The accreditation check of the credential issuers, when the session was created with `requireAccreditation`',
  })
  @IsOptional()
  public accreditation?: AccreditationCheckDto

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
    this.accreditation = params.accreditation
  }

  public static fromOpenId4VcVerificationSessionRecord(
    record: OpenId4VcVerificationSessionRecord,
    sharedAttributes?: Record<string, unknown>,
    accreditation?: AccreditationCheckDto,
  ): OpenId4VcVerificationSessionRecordDto {
    const failed = accreditation && !accreditation.verified
    return new OpenId4VcVerificationSessionRecordDto({
      ...record,
      publicVerifierId: record.verifierId,
      authorizationResponsePayload: record.authorizationResponsePayload,
      // A presentation from an issuer without an active accreditation chain is rejected
      state: failed ? OpenId4VcVerificationSessionState.Error : record.state,
      errorMessage: failed
        ? accreditation.issuers
            .filter((issuer) => !issuer.verified)
            .map((issuer) => issuer.reason)
            .join('; ')
        : record.errorMessage,
      sharedAttributes: failed ? undefined : sharedAttributes,
      accreditation,
    })
  }
}
