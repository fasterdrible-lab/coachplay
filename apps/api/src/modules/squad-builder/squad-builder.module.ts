import { Module } from '@nestjs/common';
import { SquadBuilderController } from './squad-builder.controller';
import { SquadBuilderService } from './squad-builder.service';

@Module({
  controllers: [SquadBuilderController],
  providers: [SquadBuilderService],
  exports: [SquadBuilderService],
})
export class SquadBuilderModule {}
