import { Module } from '@nestjs/common';
import { CaptureSessionsController } from './capture-sessions.controller';
import { MatchEventsController } from './match-events.controller';
import { CaptureSessionsService } from './capture-sessions.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [CaptureSessionsController, MatchEventsController],
  providers: [CaptureSessionsService],
  exports: [CaptureSessionsService],
})
export class CaptureSessionsModule {}
