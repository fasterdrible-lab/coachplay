import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { AnalysisLimitGuard } from './guards/analysis-limit.guard';

@Module({
  controllers: [PlansController],
  providers: [PlansService, AnalysisLimitGuard],
  exports: [PlansService, AnalysisLimitGuard],
})
export class PlansModule {}
