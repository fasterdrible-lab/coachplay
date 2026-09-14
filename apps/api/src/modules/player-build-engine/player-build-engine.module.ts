import { Module } from '@nestjs/common';
import { PlayerBuildEngineService } from './player-build-engine.service';

@Module({
  providers: [PlayerBuildEngineService],
  exports: [PlayerBuildEngineService],
})
export class PlayerBuildEngineModule {}
