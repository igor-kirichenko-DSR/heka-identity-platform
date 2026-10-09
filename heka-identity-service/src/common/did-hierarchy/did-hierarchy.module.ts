import { Module } from '@nestjs/common'

import { AgentModule } from 'common/agent'

import { DidHierarchyService } from './did-hierarchy.service'

@Module({
  imports: [AgentModule],
  providers: [DidHierarchyService],
  exports: [DidHierarchyService],
})
export class DidHierarchyModule {}
