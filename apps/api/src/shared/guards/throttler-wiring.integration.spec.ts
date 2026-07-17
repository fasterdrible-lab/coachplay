import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { AddressInfo } from 'net';

@Controller('ping')
class PingController {
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Get()
  ping() {
    return { ok: true };
  }
}

// Reproduz o wiring de app.module.ts: ThrottlerModule + ThrottlerGuard como APP_GUARD.
// Task 7.3 corrigiu um bug onde o ThrottlerModule estava configurado mas o ThrottlerGuard
// nunca era registrado como guard global — @Throttle no login não tinha efeito nenhum.
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
  controllers: [PingController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class ThrottlerTestModule {}

describe('ThrottlerGuard — wiring global (Task 7.3)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerTestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('bloqueia com HTTP 429 após exceder o limite definido em @Throttle', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await fetch(`${baseUrl}/ping`);
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses[3]).toBe(429);
  });
});
