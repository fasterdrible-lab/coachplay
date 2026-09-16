import { Module } from '@nestjs/common';
import { DocumentationSourcesController } from './documentation-sources.controller';
import { DocumentationSourcesService } from './documentation-sources.service';

@Module({
  controllers: [DocumentationSourcesController],
  providers: [DocumentationSourcesService],
  exports: [DocumentationSourcesService],
})
export class DocumentationSourcesModule {}
