import { Module } from '@nestjs/common';
import { PlayerBuildsController } from './player-builds.controller';
import { PlayerBuildsService } from './player-builds.service';

@Module({
  controllers: [PlayerBuildsController],
  providers: [PlayerBuildsService],
  exports: [PlayerBuildsService],
})
export class PlayerBuildsModule {}
