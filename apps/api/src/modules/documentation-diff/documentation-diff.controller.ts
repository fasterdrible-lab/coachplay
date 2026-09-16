import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { DocumentationDiffService } from './documentation-diff.service';
import { Roles } from '../../shared/decorators/roles.decorator';
import { DetectChangesDto } from './dto/detect-changes.dto';
import { FindDocumentChangesQueryDto } from './dto/find-document-changes-query.dto';

// Admin-only, disparo manual — quem chama decide QUAIS duas versões comparar. Nada aqui aprova
// ou rejeita mudança nenhuma (Tarefa 8); só detecta e deixa PENDING pra revisão humana.
@Controller('documentation-diff')
@Roles('admin')
export class DocumentationDiffController {
  constructor(private readonly diffService: DocumentationDiffService) {}

  @Post()
  detectChanges(@Body() dto: DetectChangesDto) {
    return this.diffService.detectChanges(dto.documentId, dto.oldVersionNumber, dto.newVersionNumber);
  }

  @Get()
  findAll(@Query() query: FindDocumentChangesQueryDto) {
    return this.diffService.findAll(query.documentId, query.reviewStatus);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.diffService.findOne(id);
  }
}
