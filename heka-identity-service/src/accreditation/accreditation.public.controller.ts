import { Controller, Get, Header, Param } from '@nestjs/common'
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger'

import { InjectLogger, Logger } from 'common/logger'

import { AccreditationService } from './accreditation.service'
import { AccreditationChainDto } from './dto'
import { TokenStatusListService } from './token-status-list.service'

/** What a relying party needs to verify an issuer back to the platform DID, without a token. */
@ApiTags('Accreditations (public)')
@Controller('accreditations')
export class AccreditationPublicController {
  public constructor(
    private readonly accreditationService: AccreditationService,
    private readonly statusListService: TokenStatusListService,
    @InjectLogger(AccreditationPublicController)
    private readonly logger: Logger,
  ) {
    this.logger.child('constructor').trace('<>')
  }

  @ApiOperation({
    summary: 'Token Status List of accreditations',
    description: 'A `statuslist+jwt` signed by the DID that issued the accreditations it covers',
  })
  @ApiProduces('application/statuslist+jwt')
  @ApiOkResponse({ description: 'The signed status list' })
  @ApiNotFoundResponse({ description: 'Unknown status list' })
  @Get('status-lists/:id')
  @Header('Content-Type', 'application/statuslist+jwt')
  public async getStatusList(@Param('id') id: string): Promise<string> {
    return await this.statusListService.signedList(id)
  }

  @ApiOperation({
    summary: 'Accreditation chain of a DID',
    description:
      'The accreditation credentials from the DID up to the platform DID. Verify each SD-JWT VC (signature, ' +
      'validity, status list), check that each `iss` is the `sub` of the next one, and that the last `iss` is the ' +
      'platform DID you trust.',
  })
  @ApiParam({ name: 'did', example: 'did:key:z6Mk...' })
  @ApiOkResponse({ type: AccreditationChainDto })
  @ApiNotFoundResponse({ description: 'The DID has no accreditation' })
  @Get(':did')
  public async getChain(@Param('did') did: string): Promise<AccreditationChainDto> {
    return await this.accreditationService.getChain(did)
  }
}
