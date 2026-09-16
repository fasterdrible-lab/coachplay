import { Module } from '@nestjs/common';
import { AskCoachController } from './ask-coach.controller';
import { AskCoachService } from './ask-coach.service';
import { GamesModule } from '../games/games.module';
import { PlayersModule } from '../players/players.module';
import { PlayerBuildEngineModule } from '../player-build-engine/player-build-engine.module';
import { SquadBuilderModule } from '../squad-builder/squad-builder.module';
import { EconomyAdvisorModule } from '../economy-advisor/economy-advisor.module';
import { LearningModule } from '../learning/learning.module';
import { ReportsModule } from '../reports/reports.module';
import { EfootballCoachModule } from '../efootball-coach/efootball-coach.module';

@Module({
  imports: [
    GamesModule,
    PlayersModule,
    PlayerBuildEngineModule,
    SquadBuilderModule,
    EconomyAdvisorModule,
    LearningModule,
    ReportsModule,
    EfootballCoachModule,
  ],
  controllers: [AskCoachController],
  providers: [AskCoachService],
  exports: [AskCoachService],
})
export class AskCoachModule {}
