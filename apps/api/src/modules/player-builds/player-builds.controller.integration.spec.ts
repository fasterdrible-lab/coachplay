import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'net';
import { PlayerBuildsController } from './player-builds.controller';
import { PlayerBuildsService } from './player-builds.service';

// Integração: POST /player-builds/compare (Tarefa 6) — confere o wiring da rota + validação do
// body, sem reexercitar a lógica de comparação (já coberta por build-comparator.spec.ts).
describe('PlayerBuildsController (integration) — POST /player-builds/compare', () => {
  let app: INestApplication;
  let baseUrl: string;

  const playerBuildsService = {
    compare: jest.fn().mockResolvedValue({
      cardId: 'card-1',
      position: 'CF',
      buildA: { overall: 80, attributes: {}, roleScore: 70, totalPointsUsed: 2, totalPointsAvailable: 10 },
      buildB: { overall: 85, attributes: {}, roleScore: 75, totalPointsUsed: 8, totalPointsAvailable: 10 },
      attributes: [],
      advantages: ['Overall maior (85 vs 80)'],
      disadvantages: [],
    }),
  };

  @Module({
    controllers: [PlayerBuildsController],
    providers: [{ provide: PlayerBuildsService, useValue: playerBuildsService }],
  })
  class PlayerBuildsTestModule {}

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [PlayerBuildsTestModule] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('retorna a comparação quando o body é válido', async () => {
    const res = await fetch(`${baseUrl}/player-builds/compare`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cardId: 'card-1',
        position: 'CF',
        buildA: { allocation: { finishing: 2 }, availableProgressionPoints: 10 },
        buildB: { allocation: { finishing: 8 }, availableProgressionPoints: 10 },
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.advantages).toEqual(expect.arrayContaining([expect.stringContaining('Overall maior')]));
  });

  it('rejeita body malformado (buildA sem allocation) com 400', async () => {
    const res = await fetch(`${baseUrl}/player-builds/compare`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cardId: 'card-1',
        position: 'CF',
        buildA: { availableProgressionPoints: 10 },
        buildB: { allocation: { finishing: 8 }, availableProgressionPoints: 10 },
      }),
    });

    expect(res.status).toBe(400);
  });
});
