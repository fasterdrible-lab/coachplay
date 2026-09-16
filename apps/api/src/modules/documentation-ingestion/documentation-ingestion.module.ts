import { Module } from '@nestjs/common';
import { DocumentationIngestionController } from './documentation-ingestion.controller';
import { DocumentationIngestionService } from './documentation-ingestion.service';
import { DocumentFetcherService } from './document-fetcher.service';
import { GameDocumentsModule } from '../game-documents/game-documents.module';

@Module({
  imports: [GameDocumentsModule],
  controllers: [DocumentationIngestionController],
  providers: [DocumentationIngestionService, DocumentFetcherService],
  exports: [DocumentationIngestionService, DocumentFetcherService],
})
export class DocumentationIngestionModule {}
