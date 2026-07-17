import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiCoachModule } from '../ai-coach/ai-coach.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { GameAnalysisModule } from '../game-analysis/game-analysis.module';
import { PlansModule } from '../plans/plans.module';
import { ReportsModule } from '../reports/reports.module';
import { VideoCaptureService } from './video-capture.service';
import { VideoProcessingWorker } from './video-processing.worker';
import { VIDEO_PROCESSING_QUEUE } from './video-processing.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: VIDEO_PROCESSING_QUEUE }),
    AiCoachModule,
    GameAnalysisModule,
    ReportsModule,
    PlansModule,
    AuditLogsModule,
  ],
  providers: [VideoCaptureService, VideoProcessingWorker],
  exports: [VideoCaptureService, BullModule],
})
export class VideoCaptureModule {}
