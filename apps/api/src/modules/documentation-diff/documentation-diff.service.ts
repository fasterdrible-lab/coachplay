import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentChange, DocumentChangeReviewStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { GameDocumentsService } from '../game-documents/game-documents.service';
import { GameDocumentVersionsService } from '../game-document-versions/game-document-versions.service';
import { diffDocumentContent } from './content-diff.util';

/**
 * Detector de alterações (Tarefa 6) — compara duas `GameDocumentVersion` (Tarefa 5) do mesmo
 * documento e persiste uma linha de `DocumentChange` por mudança encontrada, sempre nascendo
 * `PENDING`. Nunca decide sozinho se uma mudança é boa ou ruim — só detecta e registra; aprovar/
 * rejeitar é ação humana (Tarefa 8, fora de escopo aqui).
 */
@Injectable()
export class DocumentationDiffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameDocuments: GameDocumentsService,
    private readonly gameDocumentVersions: GameDocumentVersionsService,
  ) {}

  async detectChanges(documentId: string, oldVersionNumber: number, newVersionNumber: number): Promise<DocumentChange[]> {
    await this.gameDocuments.findOne(documentId);
    const oldVersion = await this.gameDocumentVersions.findVersion(documentId, oldVersionNumber);
    const newVersion = await this.gameDocumentVersions.findVersion(documentId, newVersionNumber);

    const detected = diffDocumentContent(oldVersion.content, newVersion.content);
    if (detected.length === 0) {
      return [];
    }

    return Promise.all(
      detected.map((change) =>
        this.prisma.documentChange.create({
          data: {
            documentId,
            oldVersion: oldVersionNumber,
            newVersion: newVersionNumber,
            changeType: change.changeType,
            changeSummary: change.changeSummary,
          },
        }),
      ),
    );
  }

  async findAll(documentId?: string, reviewStatus?: DocumentChangeReviewStatus): Promise<DocumentChange[]> {
    return this.prisma.documentChange.findMany({
      where: {
        ...(documentId && { documentId }),
        ...(reviewStatus && { reviewStatus }),
      },
      orderBy: { detectedAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<DocumentChange> {
    const change = await this.prisma.documentChange.findUnique({ where: { id } });
    if (!change) {
      throw new NotFoundException(`Alteração "${id}" não encontrada`);
    }
    return change;
  }
}
