import { Injectable, NotFoundException } from '@nestjs/common';
import { GameDocumentVersion } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';

/**
 * Histórico imutável de conteúdo (Tarefa 5) — nunca sobrescreve, só acrescenta. Confia
 * inteiramente na decisão de "houve mudança real" de quem chama (`GameDocumentsService`, que já
 * comparou `contentHash` na Tarefa 3); este serviço não re-deriva essa decisão, só numera e
 * grava a versão seguinte.
 */
@Injectable()
export class GameDocumentVersionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** `changeDetected: false` só faz sentido pra versão 1 (linha de base, sem versão anterior pra
   * comparar) — todo chamador deve passar `false` só nesse caso e `true` em qualquer outro. */
  async recordVersion(documentId: string, contentHash: string, content: string, changeDetected: boolean): Promise<GameDocumentVersion> {
    const last = await this.prisma.gameDocumentVersion.findFirst({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
    });
    const versionNumber = (last?.versionNumber ?? 0) + 1;

    return this.prisma.gameDocumentVersion.create({
      data: { documentId, versionNumber, contentHash, content, changeDetected },
    });
  }

  async findAllForDocument(documentId: string): Promise<GameDocumentVersion[]> {
    return this.prisma.gameDocumentVersion.findMany({
      where: { documentId },
      orderBy: { versionNumber: 'asc' },
    });
  }

  async findVersion(documentId: string, versionNumber: number): Promise<GameDocumentVersion> {
    const version = await this.prisma.gameDocumentVersion.findUnique({
      where: { documentId_versionNumber: { documentId, versionNumber } },
    });
    if (!version) {
      throw new NotFoundException(`Versão ${versionNumber} do documento "${documentId}" não encontrada`);
    }
    return version;
  }
}
