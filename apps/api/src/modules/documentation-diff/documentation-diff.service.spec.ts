import { NotFoundException } from '@nestjs/common';
import { DocumentationDiffService } from './documentation-diff.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { GameDocumentsService } from '../game-documents/game-documents.service';
import { GameDocumentVersionsService } from '../game-document-versions/game-document-versions.service';

describe('DocumentationDiffService (Tarefa 6)', () => {
  let prisma: { documentChange: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock } };
  let gameDocuments: { findOne: jest.Mock };
  let gameDocumentVersions: { findVersion: jest.Mock };
  let service: DocumentationDiffService;

  beforeEach(() => {
    prisma = {
      documentChange: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `change-${Math.random()}`, reviewStatus: 'PENDING', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    gameDocuments = { findOne: jest.fn().mockResolvedValue({ id: 'doc-1' }) };
    gameDocumentVersions = { findVersion: jest.fn() };

    service = new DocumentationDiffService(
      prisma as unknown as PrismaService,
      gameDocuments as unknown as GameDocumentsService,
      gameDocumentVersions as unknown as GameDocumentVersionsService,
    );
  });

  describe('detectChanges', () => {
    it('nenhuma alteração: não cria nenhum DocumentChange', async () => {
      const content = 'Controles básicos\nSegure R2 para passe';
      gameDocumentVersions.findVersion
        .mockResolvedValueOnce({ versionNumber: 1, content })
        .mockResolvedValueOnce({ versionNumber: 2, content });

      const result = await service.detectChanges('doc-1', 1, 2);

      expect(result).toEqual([]);
      expect(prisma.documentChange.create).not.toHaveBeenCalled();
    });

    it('uma alteração detectada: cria DocumentChange PENDING com oldVersion/newVersion corretos', async () => {
      gameDocumentVersions.findVersion
        .mockResolvedValueOnce({ versionNumber: 1, content: 'Você pode equipar até 5 habilidades' })
        .mockResolvedValueOnce({ versionNumber: 2, content: 'Você pode equipar até 6 habilidades' });

      const result = await service.detectChanges('doc-1', 1, 2);

      expect(result).toHaveLength(1);
      expect(result[0].reviewStatus).toBe('PENDING');
      const createCall = prisma.documentChange.create.mock.calls[0][0].data;
      expect(createCall.documentId).toBe('doc-1');
      expect(createCall.oldVersion).toBe(1);
      expect(createCall.newVersion).toBe(2);
      expect(createCall.changeType).toBe('TEXT_MODIFIED');
    });

    it('documento inexistente: propaga NotFoundException sem consultar versões', async () => {
      gameDocuments.findOne.mockRejectedValue(new NotFoundException('não encontrado'));

      await expect(service.detectChanges('doc-x', 1, 2)).rejects.toThrow(NotFoundException);
      expect(gameDocumentVersions.findVersion).not.toHaveBeenCalled();
    });

    it('versão inexistente: propaga NotFoundException sem criar DocumentChange', async () => {
      gameDocumentVersions.findVersion.mockRejectedValue(new NotFoundException('versão não encontrada'));

      await expect(service.detectChanges('doc-1', 1, 99)).rejects.toThrow(NotFoundException);
      expect(prisma.documentChange.create).not.toHaveBeenCalled();
    });

    it('múltiplas alterações: cria uma linha de DocumentChange por mudança detectada', async () => {
      gameDocumentVersions.findVersion
        .mockResolvedValueOnce({ versionNumber: 1, content: 'Título\nLinha alterada\nSeção a remover' })
        .mockResolvedValueOnce({ versionNumber: 2, content: 'Título\nLinha modificada\nNova seção' });

      const result = await service.detectChanges('doc-1', 1, 2);

      expect(result.length).toBeGreaterThan(1);
      expect(prisma.documentChange.create).toHaveBeenCalledTimes(result.length);
    });
  });

  describe('findAll / findOne', () => {
    it('findAll filtra por documentId e reviewStatus quando informados', async () => {
      await service.findAll('doc-1', 'PENDING');

      expect(prisma.documentChange.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { documentId: 'doc-1', reviewStatus: 'PENDING' } }),
      );
    });

    it('findOne lança NotFoundException quando não existe', async () => {
      await expect(service.findOne('change-x')).rejects.toThrow(NotFoundException);
    });
  });
});
