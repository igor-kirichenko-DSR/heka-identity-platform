import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

import { Accreditation, AccreditedRole } from 'common/entities'

export enum AccreditationState {
  Active = 'active',
  Revoked = 'revoked',
  Expired = 'expired',
  NotYetValid = 'notYetValid',
}

export class AccreditationDto {
  @ApiProperty({ description: 'The accredited DID (`sub` of the credential)' })
  public subject!: string

  @ApiProperty({ description: 'The parent DID that signed the accreditation (`iss`)' })
  public issuer!: string

  @ApiProperty({ description: 'Heka organization id (`org_id`)' })
  public orgId!: string

  @ApiProperty({ enum: AccreditedRole, description: 'What the subject is accredited as (`role`)' })
  public role!: AccreditedRole

  @ApiProperty()
  public validFrom!: Date

  @ApiProperty()
  public validUntil!: Date

  @ApiProperty({
    enum: AccreditationState,
    description: "Heka's view; a relying party checks the credential and its status list itself",
  })
  public state!: AccreditationState

  @ApiProperty({ description: 'The accreditation credential: a compact SD-JWT VC with a Token Status List entry' })
  public credential!: string

  public static from(accreditation: Accreditation, state: AccreditationState): AccreditationDto {
    return {
      subject: accreditation.subjectDid,
      issuer: accreditation.issuerDid,
      orgId: accreditation.orgId,
      role: accreditation.accreditedRole,
      validFrom: accreditation.validFrom,
      validUntil: accreditation.validUntil,
      state,
      credential: accreditation.credential,
    }
  }
}

export type AccreditationChainEntryDto = AccreditationDto

export class AccreditationChainDto {
  @ApiProperty()
  public did!: string

  @ApiPropertyOptional({
    description:
      "The platform DID the chain ends at, when it reaches one of this deployment's trust anchors. " +
      'A relying party compares it with the platform DID it trusts.',
  })
  public trustAnchor?: string

  @ApiProperty({ type: [AccreditationDto], description: 'Child first: the DID, then its parent, up to the platform' })
  public chain!: AccreditationChainEntryDto[]
}

export class AccreditationIssuerCheckDto {
  @ApiProperty()
  public did!: string

  @ApiProperty()
  public verified!: boolean

  @ApiPropertyOptional()
  public trustAnchor?: string

  @ApiPropertyOptional()
  public reason?: string
}

export class AccreditationCheckDto {
  @ApiProperty({ description: 'True when every credential issuer has an active chain up to a trust anchor' })
  public verified!: boolean

  @ApiProperty({ type: [AccreditationIssuerCheckDto] })
  public issuers!: AccreditationIssuerCheckDto[]
}

export class RevokeAccreditationsRequestDto {
  @ApiPropertyOptional({ description: 'Revoke the accreditation of this DID; your wallet must have issued it' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public did?: string

  @ApiPropertyOptional({
    description: "Admin only: offboard this organization (revoke every organization DID's accreditation)",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public orgId?: string

  @ApiPropertyOptional({ description: 'Recorded in the audit log' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public reason?: string
}

export class RevokeAccreditationsResponseDto {
  @ApiProperty({ type: [String], description: 'DIDs whose accreditation was revoked by this call' })
  public revoked!: string[]
}

export class ReinstateAccreditationRequestDto {
  @ApiProperty({ description: 'The DID whose accreditation your wallet revoked' })
  @IsString()
  @IsNotEmpty()
  public did!: string
}
