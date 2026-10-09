import { Module } from '@nestjs/common'

import { AccreditationModule } from 'accreditation/accreditation.module'
import { AgentModule } from 'common/agent'
import { DidHierarchyModule } from 'common/did-hierarchy'
import { DidRegistrarModule } from 'common/did-registrar'

import { DidController } from './did.controller'
import { DidService } from './did.service'

@Module({
  imports: [AgentModule, DidRegistrarModule, DidHierarchyModule, AccreditationModule],
  controllers: [DidController],
  providers: [DidService],
  exports: [DidService],
})
export class DidModule {}
