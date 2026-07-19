import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp = require('sharp');
import { GameStateDetectorService } from './game-state-detector.service';

describe('GameStateDetectorService', () => {
  let service: GameStateDetectorService;
  let dir: string;

  beforeAll(() => {
    service = new GameStateDetectorService();
    dir = mkdtempSync(join(tmpdir(), 'gsd-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  async function writeSolidColor(name: string, r: number, g: number, b: number): Promise<string> {
    const path = join(dir, name);
    await sharp({ create: { width: 128, height: 72, channels: 3, background: { r, g, b } } })
      .png()
      .toFile(path);
    return path;
  }

  it('retorna tudo nulo quando não há frame anterior (primeiro frame da sessão)', async () => {
    const current = await writeSolidColor('a.png', 10, 10, 10);

    const result = await service.detect(current, null);

    expect(result).toEqual({ gameState: null, confidence: null, motionScore: null });
  });

  it('classifica como "menu" (estático) quando dois frames são quase idênticos', async () => {
    const previous = await writeSolidColor('static-1.png', 20, 20, 20);
    const current = await writeSolidColor('static-2.png', 20, 20, 20);

    const result = await service.detect(current, previous);

    expect(result.gameState).toBe('menu');
    expect(result.confidence).not.toBeNull();
    expect(result.motionScore).toBeLessThan(0.02);
  });

  it('classifica como "match_running" (ativo) quando os frames mudam bastante', async () => {
    const previous = await writeSolidColor('active-1.png', 10, 10, 10);
    const current = await writeSolidColor('active-2.png', 240, 240, 240);

    const result = await service.detect(current, previous);

    expect(result.gameState).toBe('match_running');
    expect(result.confidence).not.toBeNull();
    expect(result.motionScore).toBeGreaterThanOrEqual(0.05);
  });
});
