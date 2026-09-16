import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GameDocumentsService } from './game-documents.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { DocumentationSourcesService } from '../documentation-sources/documentation-sources.service';
import { GameDocumentVersionsService } from '../game-document-versions/game-document-versions.service';

describe('GameDocumentsService (Tarefa 3)', () => {
  const game = { id: 'game-1', provider: 'EFOOTBALL', name: 'eFootball', active: true };
  const source = { id: 'source-1', gameId: 'game-1', sourceType: 'OFFICIAL', trustLevel: 'AUTHORITATIVE' };

  const baseDto = {
    gameId: 'game-1',
    sourceId: 'source-1',
    title: 'Controles básicos',
    url: 'https://support.konami.com/efootball/controls',
    documentType: 'CONTROLS' as const,
    language: 'pt-BR',
    rawContent: '<p>Segure R2 para passe de calcanhar</p>',
    normalizedContent: 'Segure R2 para passe de calcanhar',
  };

  let prisma: {
    game: { findUnique: jest.Mock };
    gameDocument: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  let documentationSources: { findOne: jest.Mock };
  let gameDocumentVersions: { recordVersion: jest.Mock };
  let service: GameDocumentsService;

  beforeEach(() => {
    prisma = {
      game: { findUnique: jest.fn().mockResolvedValue(game) },
      gameDocument: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'doc-1', active: true, ...data })),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      },
    };
    documentationSources = { findOne: jest.fn().mockResolvedValue(source) };
    gameDocumentVersions = { recordVersion: jest.fn().mockResolvedValue({ id: 'v1', versionNumber: 1 }) };

    service = new GameDocumentsService(
      prisma as unknown as PrismaService,
      documentationSources as unknown as DocumentationSourcesService,
      gameDocumentVersions as unknown as GameDocumentVersionsService,
    );
  });

  describe('registerDocument', () => {
    it('documento válido: cria com contentHash derivado do normalizedContent', async () => {
      const result = await service.registerDocument(baseDto);

      expect(result.isNew).toBe(true);
      expect(result.changed).toBe(true);
      expect(result.document.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(result.document.title).toBe('Controles básicos');
      // Versão 1 (Tarefa 5) — linha de base, changeDetected:false.
      expect(gameDocumentVersions.recordVersion).toHaveBeenCalledWith(
        'doc-1',
        result.document.contentHash,
        baseDto.normalizedContent,
        false,
      );
    });

    it('documento duplicado (mesma URL, mesmo conteúdo): não recria, changed:false, e não grava nova versão', async () => {
      const existingHash = require('./content-hash.util').computeContentHash(baseDto.normalizedContent);
      prisma.gameDocument.findUnique.mockResolvedValue({ id: 'doc-1', contentHash: existingHash });

      const result = await service.registerDocument(baseDto);

      expect(result.changed).toBe(false);
      expect(result.isNew).toBe(false);
      expect(prisma.gameDocument.update).toHaveBeenCalledWith({ where: { id: 'doc-1' }, data: { retrievedAt: expect.any(Date) } });
      expect(gameDocumentVersions.recordVersion).not.toHaveBeenCalled();
    });

    it('mesma URL com conteúdo alterado: atualiza os campos de conteúdo, changed:true, grava nova versão com changeDetected:true', async () => {
      prisma.gameDocument.findUnique.mockResolvedValue({ id: 'doc-1', contentHash: 'hash-antigo-diferente' });

      const result = await service.registerDocument(baseDto);

      expect(result.changed).toBe(true);
      expect(result.isNew).toBe(false);
      const updateData = prisma.gameDocument.update.mock.calls[0][0].data;
      expect(updateData.normalizedContent).toBe(baseDto.normalizedContent);
      expect(updateData.contentHash).not.toBe('hash-antigo-diferente');
      expect(gameDocumentVersions.recordVersion).toHaveBeenCalledWith(
        'doc-1',
        updateData.contentHash,
        baseDto.normalizedContent,
        true,
      );
    });

    it('documento sem source (sourceId inexistente): propaga NotFoundException', async () => {
      documentationSources.findOne.mockRejectedValue(new NotFoundException('Fonte "x" não encontrada'));

      await expect(service.registerDocument(baseDto)).rejects.toThrow(NotFoundException);
      expect(prisma.gameDocument.create).not.toHaveBeenCalled();
    });

    it('source de outro jogo: rejeita com BadRequestException', async () => {
      documentationSources.findOne.mockResolvedValue({ ...source, gameId: 'game-outro' });

      await expect(service.registerDocument(baseDto)).rejects.toThrow(BadRequestException);
    });

    it('tipo inválido: rejeita antes de tocar o banco', async () => {
      await expect(
        service.registerDocument({ ...baseDto, documentType: 'NOT_A_TYPE' as any }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.gameDocument.create).not.toHaveBeenCalled();
    });

    it('versão nova: gameVersion diferente é refletida na criação/atualização', async () => {
      const result = await service.registerDocument({ ...baseDto, gameVersion: '3.2.0' });

      expect(result.document.gameVersion).toBe('3.2.0');
    });

    it('jogo inexistente: lança NotFoundException', async () => {
      prisma.game.findUnique.mockResolvedValue(null);

      await expect(service.registerDocument(baseDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    let findMany: jest.Mock;

    beforeEach(() => {
      findMany = jest.fn().mockResolvedValue([]);
      (prisma.gameDocument as any).findMany = findMany;
    });

    it('documento desativado: filtra por active:true por padrão', async () => {
      await service.findAll('game-1');

      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { gameId: 'game-1', active: true } }));
    });

    it('includeInactive:true remove o filtro de active', async () => {
      await service.findAll('game-1', undefined, true);

      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { gameId: 'game-1' } }));
    });

    it('filtra por documentType quando informado', async () => {
      await service.findAll('game-1', 'CONTROLS');

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { gameId: 'game-1', documentType: 'CONTROLS', active: true } }),
      );
    });
  });

  describe('versionamento (Tarefa 5) — cenário completo A → A → B → C', () => {
    it('conteúdo A cria v1; reenviar A não cria versão nova; B cria v2; C cria v3 — histórico completo preservado', async () => {
      // Prisma falso com estado real (não só mocks de chamada única) pra provar a sequência
      // completa através do GameDocumentsService de verdade + GameDocumentVersionsService de
      // verdade (só a camada Prisma é fake) — exatamente o cenário exigido pela Tarefa 5.
      const documents = new Map<string, any>();
      const versions: any[] = [];
      let nextDocId = 1;
      let nextVersionId = 1;

      const fakePrisma = {
        game: { findUnique: jest.fn().mockResolvedValue(game) },
        gameDocument: {
          findUnique: jest.fn(({ where }) => Promise.resolve(documents.get(where.gameId_url.url) ?? null)),
          create: jest.fn(({ data }) => {
            const doc = { id: `doc-${nextDocId++}`, active: true, ...data };
            documents.set(doc.url, doc);
            return Promise.resolve(doc);
          }),
          update: jest.fn(({ where, data }) => {
            const existingDoc = [...documents.values()].find((d) => d.id === where.id);
            const updated = { ...existingDoc, ...data };
            documents.set(updated.url, updated);
            return Promise.resolve(updated);
          }),
        },
        gameDocumentVersion: {
          findFirst: jest.fn(({ where }) => {
            const matches = versions.filter((v) => v.documentId === where.documentId).sort((a, b) => b.versionNumber - a.versionNumber);
            return Promise.resolve(matches[0] ?? null);
          }),
          create: jest.fn(({ data }) => {
            const row = { id: `v${nextVersionId++}`, ...data };
            versions.push(row);
            return Promise.resolve(row);
          }),
        },
      };

      const realDocumentationSources = { findOne: jest.fn().mockResolvedValue(source) };
      const realVersionsService = new GameDocumentVersionsService(fakePrisma as unknown as PrismaService);
      const realService = new GameDocumentsService(
        fakePrisma as unknown as PrismaService,
        realDocumentationSources as unknown as DocumentationSourcesService,
        realVersionsService,
      );

      const dtoFor = (content: string) => ({ ...baseDto, rawContent: `<p>${content}</p>`, normalizedContent: content });

      const r1 = await realService.registerDocument(dtoFor('conteúdo A'));
      expect(r1.isNew).toBe(true);
      expect(r1.changed).toBe(true);

      const r2 = await realService.registerDocument(dtoFor('conteúdo A')); // reenvio idêntico
      expect(r2.changed).toBe(false);

      const r3 = await realService.registerDocument(dtoFor('conteúdo B'));
      expect(r3.changed).toBe(true);
      expect(r3.isNew).toBe(false);

      const r4 = await realService.registerDocument(dtoFor('conteúdo C'));
      expect(r4.changed).toBe(true);

      const history = versions.filter((v) => v.documentId === r1.document.id).sort((a, b) => a.versionNumber - b.versionNumber);

      expect(history).toHaveLength(3); // A, B, C — reenvio de A não gerou versão extra
      expect(history.map((v: any) => v.content)).toEqual(['conteúdo A', 'conteúdo B', 'conteúdo C']);
      expect(history.map((v: any) => v.versionNumber)).toEqual([1, 2, 3]);
      expect(history.map((v: any) => v.changeDetected)).toEqual([false, true, true]);
    });
  });
});
