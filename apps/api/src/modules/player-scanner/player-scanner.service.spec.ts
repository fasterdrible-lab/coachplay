import sharp = require('sharp');
import { PlayerScannerService } from './player-scanner.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { FixtureCardImageExtractor } from './fixture-card-image-extractor';
import { CardImageExtractor } from './card-image-extractor.interface';

const KVARA_PLAYER = {
  id: 'player-kvara',
  name: 'Khvicha Kvaratskhelia',
  normalizedName: 'khvicha kvaratskhelia',
  cards: [
    { id: 'card-standard', cardType: 'standard', overallBase: 85, active: true },
    { id: 'card-epic', cardType: 'epic', overallBase: 90, active: true },
  ],
};

async function validImageBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 200, height: 280, channels: 3, background: { r: 10, g: 10, b: 10 } } })
    .png()
    .toBuffer();
}

function createService(extractor: CardImageExtractor, players: unknown[] = [KVARA_PLAYER]) {
  const prisma = {
    player: { findMany: jest.fn().mockResolvedValue(players) },
    cardScan: { create: jest.fn(async ({ data }: any) => ({ id: 'scan-1', ...data })) },
  };
  const service = new PlayerScannerService(prisma as unknown as PrismaService, extractor);
  return { service, prisma };
}

describe('PlayerScannerService — fixtures da Tarefa 7', () => {
  it('carta legível: identifica automaticamente e desambigua a versão pelo overall no texto', async () => {
    const extractor = new FixtureCardImageExtractor({
      rawText: 'KHVICHA KVARATSKHELIA 90 EPIC',
      extractionConfidence: 0.97,
    });
    const { service } = createService(extractor);

    const result = await service.scan({ userId: 'u1', gameId: 'game-1', imageBuffer: await validImageBuffer() });

    expect(result.status).toBe('AUTO_IDENTIFIED');
    expect(result.matchedPlayerCardId).toBe('card-epic');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('carta cortada: nome parcial sem overall visível não identifica automaticamente', async () => {
    const extractor = new FixtureCardImageExtractor({ rawText: '...RATSKHELIA', extractionConfidence: 0.8 });
    const { service } = createService(extractor);

    const result = await service.scan({ userId: 'u1', gameId: 'game-1', imageBuffer: await validImageBuffer() });

    expect(result.status).not.toBe('AUTO_IDENTIFIED');
    expect(result.matchedPlayerCardId).toBeUndefined();
  });

  it('carta borrada: ruído de OCR (dígitos no lugar de letras) e confiança baixa não identifica automaticamente', async () => {
    const extractor = new FixtureCardImageExtractor({
      rawText: 'khv1cha kvara7skhelia',
      extractionConfidence: 0.5,
    });
    const { service } = createService(extractor);

    const result = await service.scan({ userId: 'u1', gameId: 'game-1', imageBuffer: await validImageBuffer() });

    expect(result.status).not.toBe('AUTO_IDENTIFIED');
  });

  it('carta duplicada: nome bate mas nenhum sinal desambigua entre as 2 cartas → pede confirmação com ambas', async () => {
    const extractor = new FixtureCardImageExtractor({
      rawText: 'KHVICHA KVARATSKHELIA',
      extractionConfidence: 0.9,
    });
    const { service } = createService(extractor);

    const result = await service.scan({ userId: 'u1', gameId: 'game-1', imageBuffer: await validImageBuffer() });

    expect(result.status).toBe('NEEDS_CONFIRMATION');
    expect(result.matchedPlayerCardId).toBeUndefined();
    expect(result.candidates.map((c) => c.playerCardId).sort()).toEqual(['card-epic', 'card-standard']);
  });

  it('jogador com várias versões: overall no texto desambigua corretamente qual carta é', async () => {
    const extractor = new FixtureCardImageExtractor({
      rawText: 'KHVICHA KVARATSKHELIA 85',
      extractionConfidence: 0.92,
    });
    const { service } = createService(extractor);

    const result = await service.scan({ userId: 'u1', gameId: 'game-1', imageBuffer: await validImageBuffer() });

    expect(result.status).toBe('AUTO_IDENTIFIED');
    expect(result.matchedPlayerCardId).toBe('card-standard');
  });

  it('nome parcialmente visível: não identifica automaticamente com confiança de extração baixa', async () => {
    const extractor = new FixtureCardImageExtractor({ rawText: 'K. KVARA 89', extractionConfidence: 0.6 });
    const { service } = createService(extractor);

    const result = await service.scan({ userId: 'u1', gameId: 'game-1', imageBuffer: await validImageBuffer() });

    expect(result.status).not.toBe('AUTO_IDENTIFIED');
  });

  it('imagem inválida: rejeita antes de chamar o extrator (nunca manda pra "IA adivinhar")', async () => {
    const extractSpy = jest.fn();
    const extractor: CardImageExtractor = { extract: extractSpy };
    const { service } = createService(extractor);

    const result = await service.scan({
      userId: 'u1',
      gameId: 'game-1',
      imageBuffer: Buffer.from('isto nao e uma imagem'.repeat(5)),
    });

    expect(result.status).toBe('INVALID_IMAGE');
    expect(result.confidence).toBe(0);
    expect(extractSpy).not.toHaveBeenCalled();
  });

  it('falso positivo: texto sem correspondência no banco nunca é identificado automaticamente', async () => {
    const extractor = new FixtureCardImageExtractor({ rawText: 'XZQW PLKJH RANDOMOX', extractionConfidence: 0.9 });
    const { service } = createService(extractor, []); // banco não retorna nenhum candidato

    const result = await service.scan({ userId: 'u1', gameId: 'game-1', imageBuffer: await validImageBuffer() });

    expect(result.status).toBe('NEEDS_NEW_IMAGE');
    expect(result.matchedPlayerCardId).toBeUndefined();
    expect(result.candidates).toEqual([]);
  });

  it('falso positivo: nenhuma carta é retornada como match quando a confiança fica abaixo do limiar de auto-identificação', async () => {
    // Mesmo com 1 único candidato levemente parecido, confiança moderada nunca vira AUTO_IDENTIFIED
    const extractor = new FixtureCardImageExtractor({ rawText: 'KVARATO', extractionConfidence: 0.65 });
    const { service } = createService(extractor);

    const result = await service.scan({ userId: 'u1', gameId: 'game-1', imageBuffer: await validImageBuffer() });

    expect(result.status).not.toBe('AUTO_IDENTIFIED');
  });
});
