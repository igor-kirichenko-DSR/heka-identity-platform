import { Module } from '@nestjs/common'

import { AgentModule } from 'common/agent'
import { DidHierarchyModule } from 'common/did-hierarchy'

import { AccreditationController } from './accreditation.controller'
import { AccreditationPublicController } from './accreditation.public.controller'
import { AccreditationService } from './accreditation.service'
import { TokenStatusListService } from './token-status-list.service'

@Module({
  imports: [AgentModule, DidHierarchyModule],
  controllers: [AccreditationController, AccreditationPublicController],
  providers: [AccreditationService, TokenStatusListService],
  exports: [AccreditationService],
})
export class AccreditationModule {}
