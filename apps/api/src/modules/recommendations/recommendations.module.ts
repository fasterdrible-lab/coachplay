import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { GamesModule } from '../games/games.module';
import { LearningModule } from '../learning/learning.module';
import { ProgressModule } from '../progress/progress.module';

@Module({
  imports: [GamesModule, LearningModule, ProgressModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
