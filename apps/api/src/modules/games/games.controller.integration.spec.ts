import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'net';
import { GameProvider } from '@prisma/client';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';

// Integração: GET /games retorna os jogos ativos, com o eFootball já semeado (Tarefa 2).
describe('GamesController (integration) — GET /games', () => {
  let app: INestApplication;
  let baseUrl: string;

  const gamesService = {
    findAll: jest.fn().mockResolvedValue([
      { id: 'game-1', provider: GameProvider.EFOOTBALL, name: 'eFootball', active: true },
    ]),
  };

  @Module({
    controllers: [GamesController],
    providers: [{ provide: GamesService, useValue: gamesService }],
  })
  class GamesTestModule {}

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [GamesTestModule] }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('retorna a lista de jogos ativos, incluindo o eFootball', async () => {
    const res = await fetch(`${baseUrl}/games`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.arrayContaining([expect.objectContaining({ provider: 'EFOOTBALL' })]),
    );
  });
});
