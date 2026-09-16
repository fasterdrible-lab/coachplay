import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentationSourcesService } from './documentation-sources.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('DocumentationSourcesService (Tarefa 2)', () => {
  const game = { id: 'game-1', provider: 'EFOOTBALL', name: 'eFootball', active: true };

  const baseDto = {
    gameId: 'game-1',
    name: 'Konami — Central de Ajuda',
    url: 'https://support.konami.com/efootball/controls',
    sourceType: 'OFFICIAL' as const,
    language: 'pt-BR',
  };

  let prisma: {
    game: { findUnique: jest.Mock };
    documentationSource: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  let config: { get: jest.Mock };
  let service: DocumentationSourcesService;

  beforeEach(() => {
    prisma = {
      game: { findUnique: jest.fn().mockResolvedValue(game) },
      documentationSource: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'src-1', active: true, ...data })),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      },
    };
    config = { get: jest.fn().mockReturnValue('konami.com') };

    service = new DocumentationSourcesService(prisma as unknown as PrismaService, config as unknown as ConfigService);
  });

  describe('create', () => {
    it('fonte oficial: cria com trustLevel AUTHORITATIVE por padrão', async () => {
      const result = await service.create(baseDto);

      expect(result).toMatchObject({
        sourceType: 'OFFICIAL',
        trustLevel: 'AUTHORITATIVE',
        domain: 'support.konami.com',
      });
    });

    it('URL inválida: rejeita antes de tocar o banco', async () => {
      await expect(service.create({ ...baseDto, url: 'http://konami.com/x' })).rejects.toThrow(BadRequestException);
      expect(prisma.documentationSource.create).not.toHaveBeenCalled();
    });

    it('fonte duplicada (mesma URL no mesmo jogo): lança ConflictException', async () => {
      prisma.documentationSource.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(baseDto)).rejects.toThrow(ConflictException);
    });

    it('domínio não autorizado: rejeita mesmo com URL https válida', async () => {
      config.get.mockReturnValue('other-domain.com'); // não inclui konami.com

      await expect(service.create(baseDto)).rejects.toThrow(BadRequestException);
      await expect(service.create(baseDto)).rejects.toThrow(/domínios autorizados/);
    });

    it('idioma válido: aceita "pt-BR" e "en"', async () => {
      await expect(service.create({ ...baseDto, language: 'pt-BR' })).resolves.toBeDefined();
      await expect(service.create({ ...baseDto, language: 'en' })).resolves.toBeDefined();
    });

    it('trustLevel correto: fonte comunitária recebe MEDIUM por padrão, nunca AUTHORITATIVE', async () => {
      const result = await service.create({
        ...baseDto,
        url: 'https://konami.com/wiki/community-guide',
        sourceType: 'COMMUNITY',
      });

      expect(result.trustLevel).toBe('MEDIUM');
    });

    it('impede marcar fonte comunitária automaticamente como AUTHORITATIVE (trustLevel explícito)', async () => {
      await expect(
        service.create({ ...baseDto, sourceType: 'COMMUNITY', trustLevel: 'AUTHORITATIVE' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create({ ...baseDto, sourceType: 'COMMUNITY', trustLevel: 'AUTHORITATIVE' }),
      ).rejects.toThrow(/AUTHORITATIVE/);
    });

    it('jogo inexistente: lança NotFoundException', async () => {
      prisma.game.findUnique.mockResolvedValue(null);

      await expect(service.create(baseDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('fonte inativa: filtra por padrão, só retorna ativas', async () => {
      await service.findAll('game-1');

      expect(prisma.documentationSource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { gameId: 'game-1', active: true } }),
      );
    });

    it('includeInactive:true remove o filtro de active', async () => {
      await service.findAll('game-1', true);

      expect(prisma.documentationSource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { gameId: 'game-1' } }),
      );
    });
  });

  describe('update', () => {
    it('desativa uma fonte (fonte inativa)', async () => {
      prisma.documentationSource.findUnique.mockResolvedValue({
        id: 'src-1',
        sourceType: 'OFFICIAL',
        trustLevel: 'AUTHORITATIVE',
        active: true,
      });

      const result = await service.update('src-1', { active: false });

      expect(result.active).toBe(false);
    });

    it('impede subir trustLevel pra AUTHORITATIVE numa fonte que não é OFFICIAL', async () => {
      prisma.documentationSource.findUnique.mockResolvedValue({
        id: 'src-1',
        sourceType: 'COMMUNITY',
        trustLevel: 'MEDIUM',
        active: true,
      });

      await expect(service.update('src-1', { trustLevel: 'AUTHORITATIVE' })).rejects.toThrow(BadRequestException);
    });

    it('fonte inexistente: lança NotFoundException', async () => {
      prisma.documentationSource.findUnique.mockResolvedValue(null);

      await expect(service.update('src-x', { active: false })).rejects.toThrow(NotFoundException);
    });
  });
});
