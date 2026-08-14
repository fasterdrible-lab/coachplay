import { Module } from '@nestjs/common';
import { AiCoachService } from './ai-coach.service';
import { SettingsModule } from '../settings/settings.module';
import { TacticalEngineModule } from '../tactical-engine/tactical-engine.module';

@Module({
  imports: [SettingsModule, TacticalEngineModule],
  providers: [AiCoachService],
  exports: [AiCoachService],
})
export class AiCoachModule {}
