import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CaptureSessionsController } from './capture-sessions.controller';
import { MatchEventsController } from './match-events.controller';
import { CaptureSessionsService } from './capture-sessions.service';
import { GameStateDetectorService } from './game-state-detector.service';
import { EventDetectorService } from './event-detector.service';
import { CaptureFrameAnalysisWorker } from './capture-frame-analysis.worker';
import { CAPTURE_FRAME_ANALYSIS_QUEUE } from './capture-frame-analysis.constants';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AiCoachModule } from '../ai-coach/ai-coach.module';

@Module({
  imports: [AuditLogsModule, AiCoachModule, BullModule.registerQueue({ name: CAPTURE_FRAME_ANALYSIS_QUEUE })],
  controllers: [CaptureSessionsController, MatchEventsController],
  providers: [CaptureSessionsService, GameStateDetectorService, EventDetectorService, CaptureFrameAnalysisWorker],
  exports: [CaptureSessionsService],
})
export class CaptureSessionsModule {}
