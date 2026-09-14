import { Module } from '@nestjs/common';
import { UserPlayersController } from './user-players.controller';
import { UserPlayersService } from './user-players.service';

@Module({
  controllers: [UserPlayersController],
  providers: [UserPlayersService],
  exports: [UserPlayersService],
})
export class UserPlayersModule {}
