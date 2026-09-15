import { Module } from '@nestjs/common';
import { EfootballCoachService } from './efootball-coach.service';

@Module({
  providers: [EfootballCoachService],
  exports: [EfootballCoachService],
})
export class EfootballCoachModule {}
