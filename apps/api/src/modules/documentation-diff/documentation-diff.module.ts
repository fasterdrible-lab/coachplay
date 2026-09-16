import { Module } from '@nestjs/common';
import { DocumentationDiffController } from './documentation-diff.controller';
import { DocumentationDiffService } from './documentation-diff.service';
import { GameDocumentsModule } from '../game-documents/game-documents.module';
import { GameDocumentVersionsModule } from '../game-document-versions/game-document-versions.module';

@Module({
  imports: [GameDocumentsModule, GameDocumentVersionsModule],
  controllers: [DocumentationDiffController],
  providers: [DocumentationDiffService],
  exports: [DocumentationDiffService],
})
export class DocumentationDiffModule {}
