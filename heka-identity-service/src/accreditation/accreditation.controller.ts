import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import { AuthInfo, JwtAuthGuard, ReqAuthInfo, Role } from 'common/auth'
import { RoleGuard, Roles } from 'common/authz'
import { InjectLogger, Logger } from 'common/logger'

import { AccreditationService } from './accreditation.service'
import {
  AccreditationDto,
  ReinstateAccreditationRequestDto,
  RevokeAccreditationsRequestDto,
  RevokeAccreditationsResponseDto,
} from './dto'

/**
 * The parent manages the accreditations its wallet issued: `Admin` those of organizations, `OrgAdmin` those of its
 * organization's issuers. The service checks the role and the issuing wallet on every call, also when the role model
 * is disabled.
 */
@ApiTags('Accreditations')
@ApiBearerAuth()
@Controller('accreditations')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(Role.Admin, Role.OrgAdmin)
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@ApiForbiddenResponse({ description: 'Not an Admin or OrgAdmin, or the accreditation was not issued by your wallet' })
export class AccreditationController {
  public constructor(
    private readonly accreditationService: AccreditationService,
    @InjectLogger(AccreditationController)
    private readonly logger: Logger,
  ) {
    this.logger.child('constructor').trace('<>')
  }

  @ApiOperation({
    summary: 'Revoke accreditations',
    description:
      'With `did`: revoke the accreditation your wallet issued for that DID. With `orgId` (Admin): offboard the ' +
      "organization by revoking its DIDs' accreditations. Verifiers that check the chain then reject every credential " +
      'the DID signed, including earlier ones.',
  })
  @ApiOkResponse({ type: RevokeAccreditationsResponseDto })
  @ApiBadRequestResponse({ description: 'Neither or both of did and orgId' })
  @ApiNotFoundResponse({ description: 'The DID has no accreditation' })
  @HttpCode(200)
  @Post('revoke')
  public async revoke(
    @ReqAuthInfo() authInfo: AuthInfo,
    @Body() body: RevokeAccreditationsRequestDto,
  ): Promise<RevokeAccreditationsResponseDto> {
    return await this.accreditationService.revoke(authInfo, body)
  }

  @ApiOperation({
    summary: 'Reinstate an accreditation',
    description: 'Issue a new accreditation for a DID whose accreditation your wallet revoked',
  })
  @ApiCreatedResponse({ type: AccreditationDto })
  @ApiNotFoundResponse({ description: 'The DID has no accreditation' })
  @Post('reinstate')
  public async reinstate(
    @ReqAuthInfo() authInfo: AuthInfo,
    @Body() body: ReinstateAccreditationRequestDto,
  ): Promise<AccreditationDto> {
    return await this.accreditationService.reinstate(authInfo, body.did)
  }
}
