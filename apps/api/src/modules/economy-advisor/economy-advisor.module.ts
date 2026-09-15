import { Module } from '@nestjs/common';
import { EconomyAdvisorController } from './economy-advisor.controller';
import { EconomyAdvisorService } from './economy-advisor.service';
import { SquadBuilderModule } from '../squad-builder/squad-builder.module';

@Module({
  imports: [SquadBuilderModule],
  controllers: [EconomyAdvisorController],
  providers: [EconomyAdvisorService],
  exports: [EconomyAdvisorService],
})
export class EconomyAdvisorModule {}
