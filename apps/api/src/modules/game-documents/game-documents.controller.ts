import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { GameDocumentsService } from './game-documents.service';
import { GameDocumentVersionsService } from '../game-document-versions/game-document-versions.service';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RegisterGameDocumentDto } from './dto/register-game-document.dto';
import { FindGameDocumentsQueryDto } from './dto/find-game-documents-query.dto';
import { UpdateGameDocumentDto } from './dto/update-game-document.dto';

// Admin-only — mesmo padrão de documentation-sources (Tarefa 2); registro manual/de teste até a
// Tarefa 4 (coletor automático) existir e passar a chamar registerDocument() internamente.
@Controller('game-documents')
@Roles('admin')
export class GameDocumentsController {
  constructor(
    private readonly gameDocumentsService: GameDocumentsService,
    private readonly gameDocumentVersionsService: GameDocumentVersionsService,
  ) {}

  @Post()
  register(@Body() dto: RegisterGameDocumentDto) {
    return this.gameDocumentsService.registerDocument(dto);
  }

  @Get()
  findAll(@Query() query: FindGameDocumentsQueryDto) {
    return this.gameDocumentsService.findAll(query.gameId, query.documentType, query.includeInactive);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gameDocumentsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGameDocumentDto) {
    return this.gameDocumentsService.update(id, dto);
  }

  @Get(':id/versions')
  async findVersions(@Param('id') id: string) {
    await this.gameDocumentsService.findOne(id); // 404 explícito se o documento não existir
    return this.gameDocumentVersionsService.findAllForDocument(id);
  }

  @Get(':id/versions/:versionNumber')
  async findVersion(@Param('id') id: string, @Param('versionNumber', ParseIntPipe) versionNumber: number) {
    await this.gameDocumentsService.findOne(id);
    return this.gameDocumentVersionsService.findVersion(id, versionNumber);
  }
}
