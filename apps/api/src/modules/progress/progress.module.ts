import { Module } from '@nestjs/common';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { GamesModule } from '../games/games.module';
import { LearningModule } from '../learning/learning.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [GamesModule, LearningModule, ReportsModule],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
