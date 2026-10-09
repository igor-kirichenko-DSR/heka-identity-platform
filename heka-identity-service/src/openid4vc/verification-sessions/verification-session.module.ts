import { Module } from '@nestjs/common'

import { AccreditationModule } from 'accreditation/accreditation.module'
import { AgentModule } from 'common/agent'

import { OpenId4VcVerificationSessionController } from './verification-session.controller'
import { OpenId4VcVerificationSessionService } from './verification-session.service'

@Module({
  imports: [AgentModule, AccreditationModule],
  controllers: [OpenId4VcVerificationSessionController],
  providers: [OpenId4VcVerificationSessionService],
  exports: [OpenId4VcVerificationSessionService],
})
export class OpenId4VcVerificationSessionModule {}
