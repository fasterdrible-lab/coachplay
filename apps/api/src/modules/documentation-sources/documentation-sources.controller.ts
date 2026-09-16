import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DocumentationSourcesService } from './documentation-sources.service';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CreateDocumentationSourceDto } from './dto/create-documentation-source.dto';
import { UpdateDocumentationSourceDto } from './dto/update-documentation-source.dto';
import { FindDocumentationSourcesQueryDto } from './dto/find-documentation-sources-query.dto';

// Configuração de fonte de documentação é ação administrativa — mesmo padrão de
// SettingsController (chaves de IA): admin-only, não faz parte da navegação de um jogador comum.
@Controller('documentation-sources')
@Roles('admin')
export class DocumentationSourcesController {
  constructor(private readonly documentationSourcesService: DocumentationSourcesService) {}

  @Post()
  create(@Body() dto: CreateDocumentationSourceDto) {
    return this.documentationSourcesService.create(dto);
  }

  @Get()
  findAll(@Query() query: FindDocumentationSourcesQueryDto) {
    return this.documentationSourcesService.findAll(query.gameId, query.includeInactive);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentationSourcesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDocumentationSourceDto) {
    return this.documentationSourcesService.update(id, dto);
  }
}
