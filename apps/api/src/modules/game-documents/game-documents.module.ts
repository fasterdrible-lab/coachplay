import { Module } from '@nestjs/common';
import { GameDocumentsController } from './game-documents.controller';
import { GameDocumentsService } from './game-documents.service';
import { DocumentationSourcesModule } from '../documentation-sources/documentation-sources.module';
import { GameDocumentVersionsModule } from '../game-document-versions/game-document-versions.module';

@Module({
  imports: [DocumentationSourcesModule, GameDocumentVersionsModule],
  controllers: [GameDocumentsController],
  providers: [GameDocumentsService],
  exports: [GameDocumentsService],
})
export class GameDocumentsModule {}
