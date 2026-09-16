import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GameDocument, GameDocumentType } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { DocumentationSourcesService } from '../documentation-sources/documentation-sources.service';
import { GameDocumentVersionsService } from '../game-document-versions/game-document-versions.service';
import { RegisterGameDocumentDto } from './dto/register-game-document.dto';
import { UpdateGameDocumentDto } from './dto/update-game-document.dto';
import { computeContentHash } from './content-hash.util';

export interface RegisterDocumentResult {
  document: GameDocument;
  /** `false` quando o `contentHash` bate com o que já estava salvo — "documento duplicado",
   * nenhum campo de conteúdo foi reescrito, só `retrievedAt`. */
  changed: boolean;
  isNew: boolean;
}

/**
 * Registro de documentos (Tarefa 3) — representa o estado ATUAL de 1 documento por
 * (gameId, url). Toda vez que `changed: true` (documento novo ou conteúdo alterado), também
 * grava uma linha imutável em `GameDocumentVersion` (Tarefa 5) — histórico completo, nunca
 * sobrescrito.
 */
@Injectable()
export class GameDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentationSources: DocumentationSourcesService,
    private readonly gameDocumentVersions: GameDocumentVersionsService,
  ) {}

  /** Upsert por (gameId, url) — a mesma URL pode (e deve) ser re-registrada ao longo do tempo
   * pelo futuro coletor (Tarefa 4); "criar de novo" não existe como conceito separado daqui. */
  async registerDocument(dto: RegisterGameDocumentDto): Promise<RegisterDocumentResult> {
    if (!Object.values(GameDocumentType).includes(dto.documentType)) {
      throw new BadRequestException(`Tipo de documento inválido: ${dto.documentType}`);
    }

    const game = await this.prisma.game.findUnique({ where: { id: dto.gameId } });
    if (!game) {
      throw new NotFoundException(`Jogo "${dto.gameId}" não encontrado`);
    }

    // Reaproveita a Tarefa 2 — nunca aceita um sourceId que não existe; lança NotFoundException
    // por conta própria se a fonte não existir ("documento sem source").
    const source = await this.documentationSources.findOne(dto.sourceId);
    if (source.gameId !== dto.gameId) {
      throw new BadRequestException('A fonte informada pertence a outro jogo');
    }

    const contentHash = computeContentHash(dto.normalizedContent);
    const retrievedAt = new Date();

    const existing = await this.prisma.gameDocument.findUnique({
      where: { gameId_url: { gameId: dto.gameId, url: dto.url } },
    });

    if (!existing) {
      const document = await this.prisma.gameDocument.create({
        data: {
          gameId: dto.gameId,
          sourceId: dto.sourceId,
          title: dto.title,
          url: dto.url,
          documentType: dto.documentType,
          language: dto.language,
          gameVersion: dto.gameVersion,
          publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
          retrievedAt,
          contentHash,
          rawContent: dto.rawContent,
          normalizedContent: dto.normalizedContent,
        },
      });
      // Versão 1 — linha de base, não há versão anterior pra comparar (changeDetected: false).
      await this.gameDocumentVersions.recordVersion(document.id, contentHash, dto.normalizedContent, false);
      return { document, changed: true, isNew: true };
    }

    if (existing.contentHash === contentHash) {
      const document = await this.prisma.gameDocument.update({
        where: { id: existing.id },
        data: { retrievedAt },
      });
      return { document, changed: false, isNew: false };
    }

    const document = await this.prisma.gameDocument.update({
      where: { id: existing.id },
      data: {
        title: dto.title,
        sourceId: dto.sourceId,
        documentType: dto.documentType,
        language: dto.language,
        gameVersion: dto.gameVersion,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
        retrievedAt,
        contentHash,
        rawContent: dto.rawContent,
        normalizedContent: dto.normalizedContent,
      },
    });
    // Conteúdo mudou de verdade — nunca sobrescreve a versão anterior silenciosamente, preserva
    // como nova versão (changeDetected: true).
    await this.gameDocumentVersions.recordVersion(document.id, contentHash, dto.normalizedContent, true);
    return { document, changed: true, isNew: false };
  }

  async findAll(gameId: string, documentType?: GameDocumentType, includeInactive = false): Promise<GameDocument[]> {
    return this.prisma.gameDocument.findMany({
      where: {
        gameId,
        ...(documentType && { documentType }),
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<GameDocument> {
    const document = await this.prisma.gameDocument.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException(`Documento "${id}" não encontrado`);
    }
    return document;
  }

  async update(id: string, dto: UpdateGameDocumentDto): Promise<GameDocument> {
    await this.findOne(id);

    return this.prisma.gameDocument.update({
      where: { id },
      data: { ...(dto.active !== undefined && { active: dto.active }) },
    });
  }
}
