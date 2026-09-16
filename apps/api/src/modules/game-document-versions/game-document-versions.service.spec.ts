import { NotFoundException } from '@nestjs/common';
import { GameDocumentVersionsService } from './game-document-versions.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('GameDocumentVersionsService (Tarefa 5)', () => {
  let versions: Array<{ id: string; documentId: string; versionNumber: number; contentHash: string; content: string; changeDetected: boolean }>;
  let prisma: {
    gameDocumentVersion: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let service: GameDocumentVersionsService;

  beforeEach(() => {
    versions = [];
    let nextId = 1;

    prisma = {
      gameDocumentVersion: {
        findFirst: jest.fn(({ where }) => {
          const matches = versions.filter((v) => v.documentId === where.documentId).sort((a, b) => b.versionNumber - a.versionNumber);
          return Promise.resolve(matches[0] ?? null);
        }),
        create: jest.fn(({ data }) => {
          const row = { id: `v${nextId++}`, ...data };
          versions.push(row);
          return Promise.resolve(row);
        }),
        findMany: jest.fn(({ where }) =>
          Promise.resolve(versions.filter((v) => v.documentId === where.documentId).sort((a, b) => a.versionNumber - b.versionNumber)),
        ),
        findUnique: jest.fn(({ where }) =>
          Promise.resolve(
            versions.find((v) => v.documentId === where.documentId_versionNumber.documentId && v.versionNumber === where.documentId_versionNumber.versionNumber) ?? null,
          ),
        ),
      },
    };

    service = new GameDocumentVersionsService(prisma as unknown as PrismaService);
  });

  it('conteúdo A → versão 1', async () => {
    const v1 = await service.recordVersion('doc-1', 'hash-a', 'conteúdo A', false);

    expect(v1.versionNumber).toBe(1);
    expect(v1.changeDetected).toBe(false);
    expect(v1.content).toBe('conteúdo A');
  });

  it('conteúdo B → versão 2 (após versão 1 já existir)', async () => {
    await service.recordVersion('doc-1', 'hash-a', 'conteúdo A', false);
    const v2 = await service.recordVersion('doc-1', 'hash-b', 'conteúdo B', true);

    expect(v2.versionNumber).toBe(2);
    expect(v2.changeDetected).toBe(true);
  });

  it('conteúdo C → versão 3', async () => {
    await service.recordVersion('doc-1', 'hash-a', 'conteúdo A', false);
    await service.recordVersion('doc-1', 'hash-b', 'conteúdo B', true);
    const v3 = await service.recordVersion('doc-1', 'hash-c', 'conteúdo C', true);

    expect(v3.versionNumber).toBe(3);
  });

  it('histórico completo: findAllForDocument retorna A, B, C em ordem, nada sobrescrito', async () => {
    await service.recordVersion('doc-1', 'hash-a', 'conteúdo A', false);
    await service.recordVersion('doc-1', 'hash-b', 'conteúdo B', true);
    await service.recordVersion('doc-1', 'hash-c', 'conteúdo C', true);

    const history = await service.findAllForDocument('doc-1');

    expect(history).toHaveLength(3);
    expect(history.map((v) => v.content)).toEqual(['conteúdo A', 'conteúdo B', 'conteúdo C']);
    expect(history.map((v) => v.versionNumber)).toEqual([1, 2, 3]);
  });

  it('numeração de versão é isolada por documento', async () => {
    await service.recordVersion('doc-1', 'hash-a', 'conteúdo A', false);
    const otherDocV1 = await service.recordVersion('doc-2', 'hash-x', 'outro documento', false);

    expect(otherDocV1.versionNumber).toBe(1);
  });

  it('findVersion retorna a versão específica pedida', async () => {
    await service.recordVersion('doc-1', 'hash-a', 'conteúdo A', false);
    await service.recordVersion('doc-1', 'hash-b', 'conteúdo B', true);

    const v1 = await service.findVersion('doc-1', 1);

    expect(v1.content).toBe('conteúdo A');
  });

  it('findVersion lança NotFoundException para versão inexistente', async () => {
    await expect(service.findVersion('doc-1', 99)).rejects.toThrow(NotFoundException);
  });
});
