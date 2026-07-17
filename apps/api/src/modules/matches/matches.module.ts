import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { VIDEO_PROCESSING_QUEUE } from '../video-capture/video-processing.constants';
import { PlansModule } from '../plans/plans.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: VIDEO_PROCESSING_QUEUE }),
    PlansModule,
    AuditLogsModule,
  ],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
