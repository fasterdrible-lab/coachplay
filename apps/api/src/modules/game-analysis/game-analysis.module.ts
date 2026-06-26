import { Module } from '@nestjs/common';
import { GameAnalysisService } from './game-analysis.service';

@Module({
  providers: [GameAnalysisService],
  exports: [GameAnalysisService],
})
export class GameAnalysisModule {}
