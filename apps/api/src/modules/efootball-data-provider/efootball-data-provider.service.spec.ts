import { EfootballDataProviderService } from './efootball-data-provider.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { buildFixturePlayers } from './efootball-fixtures';

/**
 * Fake Prisma em memória com o mínimo necessário pra reproduzir o comportamento relacional
 * (unicidade gameId+externalId / playerId+externalId) que o pipeline depende — os specs do
 * resto do projeto mockam chamada a chamada porque testam um único caminho por teste; aqui o
 * cenário exigido pela Tarefa 4 (importar → reimportar → alterar) precisa de estado persistindo
 * entre chamadas, o que um jest.fn() por método não reproduz sozinho.
 */
function createInMemoryPrisma() {
  const players: any[] = [];
  const playerCards: any[] = [];
  const dataImportRuns: any[] = [];
  const dataImportChanges: any[] = [];
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;

  const prisma = {
    player: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.gameId_externalId) {
          const { gameId, externalId } = where.gameId_externalId;
          return players.find((p) => p.gameId === gameId && p.externalId === externalId) ?? null;
        }
        return players.find((p) => p.id === where.id) ?? null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId('player'), ...data };
        players.push(row);
        return row;
      }),
    },
    playerCard: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.playerId_externalId) {
          const { playerId, externalId } = where.playerId_externalId;
          return playerCards.find((c) => c.playerId === playerId && c.externalId === externalId) ?? null;
        }
        return playerCards.find((c) => c.id === where.id) ?? null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId('card'), ...data };
        playerCards.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = playerCards.find((c) => c.id === where.id);
        Object.assign(row, data);
        return row;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return playerCards
          .filter((c) => c.active === true)
          .map((c) => ({ ...c, player: players.find((p) => p.id === c.playerId) }))
          .filter((c) => c.player?.gameId === where.player.gameId)
          .map((c) => ({ id: c.id, externalId: c.externalId, player: { externalId: c.player.externalId } }));
      }),
    },
    dataImportRun: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId('run'), ...data };
        dataImportRuns.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = dataImportRuns.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
    dataImportChange: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId('change'), ...data };
        dataImportChanges.push(row);
        return row;
      }),
    },
  };

  return { prisma, players, playerCards, dataImportRuns, dataImportChanges };
}

describe('EfootballDataProviderService', () => {
  const meta = { gameId: 'game-1', gameDataSourceId: 'ds-1', source: 'fixture', sourceVersion: 'v1' };

  it('importa 100 jogadores novos → 100 persistidos, 0 duplicados', async () => {
    const { prisma, players, playerCards } = createInMemoryPrisma();
    const service = new EfootballDataProviderService(prisma as unknown as PrismaService);
    const records = buildFixturePlayers(100);

    const run = await service.importBatch({ ...meta, records });

    expect(players).toHaveLength(100);
    expect(playerCards).toHaveLength(100);
    expect(run.createdCount).toBe(100);
    expect(run.unchangedCount).toBe(0);
    expect(run.status).toBe('done');
  });

  it('reimportar o mesmo lote: 100 recebidos, 0 duplicados criados', async () => {
    const { prisma, players, playerCards } = createInMemoryPrisma();
    const service = new EfootballDataProviderService(prisma as unknown as PrismaService);
    const records = buildFixturePlayers(100);

    await service.importBatch({ ...meta, records });
    const run2 = await service.importBatch({ ...meta, records });

    expect(players).toHaveLength(100);
    expect(playerCards).toHaveLength(100);
    expect(run2.createdCount).toBe(0);
    expect(run2.unchangedCount).toBe(100);
  });

  it('alterar uma carta: 1 atualização detectada, 99 sem alteração', async () => {
    const { prisma } = createInMemoryPrisma();
    const service = new EfootballDataProviderService(prisma as unknown as PrismaService);
    const records = buildFixturePlayers(100);

    await service.importBatch({ ...meta, records });

    const altered = records.map((r, i) =>
      i === 0 ? { ...r, cards: [{ ...r.cards[0], overallBase: r.cards[0].overallBase + 1 }] } : r,
    );
    const run2 = await service.importBatch({ ...meta, sourceVersion: 'v2', records: altered });

    expect(run2.createdCount).toBe(0);
    expect(run2.updatedCount).toBe(1);
    expect(run2.unchangedCount).toBe(99);
  });

  it('carta ausente do lote seguinte é marcada como removida', async () => {
    const { prisma, playerCards } = createInMemoryPrisma();
    const service = new EfootballDataProviderService(prisma as unknown as PrismaService);
    const records = buildFixturePlayers(5);

    await service.importBatch({ ...meta, records });
    const run2 = await service.importBatch({ ...meta, sourceVersion: 'v2', records: records.slice(1) });

    expect(run2.removedCount).toBe(1);
    expect(playerCards.find((c) => c.externalId === records[0].cards[0].externalId)?.active).toBe(false);
  });

  it('jogador novo adicionado a um lote existente gera apenas 1 criação', async () => {
    const { prisma, players } = createInMemoryPrisma();
    const service = new EfootballDataProviderService(prisma as unknown as PrismaService);
    const records = buildFixturePlayers(5);

    await service.importBatch({ ...meta, records });
    const sixth = buildFixturePlayers(6)[5];
    const run2 = await service.importBatch({ ...meta, sourceVersion: 'v2', records: [...records, sixth] });

    expect(players).toHaveLength(6);
    expect(run2.createdCount).toBe(1);
    expect(run2.unchangedCount).toBe(5);
  });

  it('erro de importação: registro inválido é rejeitado sem derrubar o restante do lote', async () => {
    const { prisma, players } = createInMemoryPrisma();
    const service = new EfootballDataProviderService(prisma as unknown as PrismaService);
    const records = buildFixturePlayers(3);
    const invalid = { ...records[0], externalId: 'broken', cards: [{ ...records[0].cards[0], overallBase: 999 }] };

    const run = await service.importBatch({ ...meta, records: [...records, invalid as any] });

    expect(players).toHaveLength(3);
    expect(run.errorCount).toBe(1);
    expect(run.status).toBe('partial');
    expect(run.errorDetail).toEqual(
      expect.arrayContaining([expect.objectContaining({ externalId: 'broken' })]),
    );
  });

  it('lote inteiramente inválido resulta em status failed', async () => {
    const { prisma } = createInMemoryPrisma();
    const service = new EfootballDataProviderService(prisma as unknown as PrismaService);

    const run = await service.importBatch({
      ...meta,
      records: [{ externalId: 'x', name: 'X', cards: [] } as any],
    });

    expect(run.status).toBe('failed');
    expect(run.createdCount).toBe(0);
  });
});
