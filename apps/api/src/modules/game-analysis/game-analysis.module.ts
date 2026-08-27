import { Module } from '@nestjs/common';
import { GameAnalysisService } from './game-analysis.service';
import { GeminiVisionService } from './gemini-vision.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [GameAnalysisService, GeminiVisionService],
  exports: [GameAnalysisService],
})
export class GameAnalysisModule {}
