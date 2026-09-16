import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DocumentFetcherService } from './document-fetcher.service';
import { sanitizeRawHtml, htmlToPlainText } from './html-sanitizer.util';
import { GameDocumentsService, RegisterDocumentResult } from '../game-documents/game-documents.service';
import { IngestDocumentDto } from './dto/ingest-document.dto';

export interface IngestDocumentResult extends RegisterDocumentResult {
  finalUrl: string;
  httpStatus: number;
  redirectCount: number;
  fetchAttempts: number;
}

/**
 * Orquestra o fluxo completo da Tarefa 4 (fetch→sanitize→normalize→hash→compare→store).
 * "hash", "compare" e "store" são inteiramente reaproveitados de `GameDocumentsService`
 * (Tarefa 3) — `registerDocument()` já faz upsert por `(gameId, url)` comparando `contentHash`;
 * duplicar essa lógica aqui seria o mesmo bug em dois lugares.
 */
@Injectable()
export class DocumentationIngestionService {
  private readonly logger = new Logger(DocumentationIngestionService.name);

  constructor(
    private readonly fetcher: DocumentFetcherService,
    private readonly gameDocuments: GameDocumentsService,
  ) {}

  async ingest(dto: IngestDocumentDto): Promise<IngestDocumentResult> {
    const fetchResult = await this.fetcher.fetchDocument(dto.url);

    const sanitizedHtml = sanitizeRawHtml(fetchResult.html);
    const normalizedContent = htmlToPlainText(sanitizedHtml);

    // "Nunca corrige silenciosamente" — um documento que normaliza pra texto vazio (HTML vazio,
    // ou só marcação sem conteúdo) não vira um GameDocument fantasma; falha alto e explícito.
    if (normalizedContent.trim().length === 0) {
      throw new BadRequestException(`Documento vazio após sanitização/normalização: "${dto.url}"`);
    }

    const registerResult = await this.gameDocuments.registerDocument({
      gameId: dto.gameId,
      sourceId: dto.sourceId,
      title: dto.title,
      url: dto.url,
      documentType: dto.documentType,
      language: dto.language,
      gameVersion: dto.gameVersion,
      publishedAt: dto.publishedAt,
      rawContent: sanitizedHtml,
      normalizedContent,
    });

    this.logger.log(
      `Ingestão de "${dto.url}": isNew=${registerResult.isNew} changed=${registerResult.changed} ` +
        `(${fetchResult.attempts} tentativa(s), ${fetchResult.redirectCount} redirecionamento(s))`,
    );

    return {
      ...registerResult,
      finalUrl: fetchResult.finalUrl,
      httpStatus: fetchResult.httpStatus,
      redirectCount: fetchResult.redirectCount,
      fetchAttempts: fetchResult.attempts,
    };
  }
}
