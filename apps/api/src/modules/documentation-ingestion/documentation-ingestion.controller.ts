import { Body, Controller, Post } from '@nestjs/common';
import { DocumentationIngestionService } from './documentation-ingestion.service';
import { Roles } from '../../shared/decorators/roles.decorator';
import { IngestDocumentDto } from './dto/ingest-document.dto';

// Admin-only, disparo manual — agendamento automático (cron/fila) é a Tarefa 21 (Monitoramento
// de Alterações), fora do escopo desta tarefa.
@Controller('documentation-ingestion')
@Roles('admin')
export class DocumentationIngestionController {
  constructor(private readonly ingestionService: DocumentationIngestionService) {}

  @Post()
  ingest(@Body() dto: IngestDocumentDto) {
    return this.ingestionService.ingest(dto);
  }
}
