import { Module } from '@nestjs/common';
import { SquadBuilderController } from './squad-builder.controller';
import { SquadBuilderService } from './squad-builder.service';
import { EfootballCoachModule } from '../efootball-coach/efootball-coach.module';

@Module({
  imports: [EfootballCoachModule],
  controllers: [SquadBuilderController],
  providers: [SquadBuilderService],
  exports: [SquadBuilderService],
})
export class SquadBuilderModule {}
