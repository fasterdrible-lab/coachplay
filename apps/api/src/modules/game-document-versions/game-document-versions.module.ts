import { Module } from '@nestjs/common';
import { GameDocumentVersionsService } from './game-document-versions.service';

@Module({
  providers: [GameDocumentVersionsService],
  exports: [GameDocumentVersionsService],
})
export class GameDocumentVersionsModule {}
