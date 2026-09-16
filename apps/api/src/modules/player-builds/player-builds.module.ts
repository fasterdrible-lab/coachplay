import { Module } from '@nestjs/common';
import { PlayerBuildsController } from './player-builds.controller';
import { PlayerBuildsService } from './player-builds.service';
import { PlayerBuildEngineModule } from '../player-build-engine/player-build-engine.module';

@Module({
  imports: [PlayerBuildEngineModule],
  controllers: [PlayerBuildsController],
  providers: [PlayerBuildsService],
  exports: [PlayerBuildsService],
})
export class PlayerBuildsModule {}
