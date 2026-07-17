import { Module } from '@nestjs/common';
import { AiCoachService } from './ai-coach.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [AiCoachService],
  exports: [AiCoachService],
})
export class AiCoachModule {}
