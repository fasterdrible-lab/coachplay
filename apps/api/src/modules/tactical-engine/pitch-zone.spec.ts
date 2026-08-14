import { isValidPitchCoordinate } from './pitch-coordinate.type';
import {
  PitchChannel,
  PitchThird,
  getAllPitchZones,
  getNeighboringZones,
  getPitchZone,
  invertPitchSide,
  pitchZoneEquals,
} from './pitch-zone';

describe('isValidPitchCoordinate', () => {
  it.each([
    [{ x: 0, y: 0 }, true],
    [{ x: 1, y: 1 }, true],
    [{ x: 0.5, y: 0.5 }, true],
  ])('%o → %s', (coordinate, expected) => {
    expect(isValidPitchCoordinate(coordinate)).toBe(expected);
  });

  it.each([
    [{ x: -0.01, y: 0.5 }],
    [{ x: 1.01, y: 0.5 }],
    [{ x: 0.5, y: -0.01 }],
    [{ x: 0.5, y: 1.01 }],
    [{ x: NaN, y: 0.5 }],
    [{ x: 0.5, y: Infinity }],
  ])('rejeita coordenada fora de [0,1] ou não finita: %o', (coordinate) => {
    expect(isValidPitchCoordinate(coordinate)).toBe(false);
  });
});

describe('getPitchZone', () => {
  it('classifica o canto defensivo esquerdo (origem)', () => {
    expect(getPitchZone({ x: 0, y: 0 })).toEqual({
      third: PitchThird.DEFENSIVE_THIRD,
      channel: PitchChannel.LEFT_CHANNEL,
    });
  });

  it('classifica o canto ofensivo direito (extremo)', () => {
    expect(getPitchZone({ x: 1, y: 1 })).toEqual({
      third: PitchThird.ATTACKING_THIRD,
      channel: PitchChannel.RIGHT_CHANNEL,
    });
  });

  it('classifica o centro exato do campo', () => {
    expect(getPitchZone({ x: 0.5, y: 0.5 })).toEqual({
      third: PitchThird.MIDDLE_THIRD,
      channel: PitchChannel.CENTRAL_CHANNEL,
    });
  });

  describe('limites de terço (eixo y)', () => {
    it('y = 1/3 (limite inclusivo) ainda é terço defensivo', () => {
      expect(getPitchZone({ x: 0.5, y: 1 / 3 }).third).toBe(PitchThird.DEFENSIVE_THIRD);
    });

    it('y logo acima de 1/3 já é terço do meio', () => {
      expect(getPitchZone({ x: 0.5, y: 1 / 3 + 0.001 }).third).toBe(PitchThird.MIDDLE_THIRD);
    });

    it('y = 2/3 (limite inclusivo) ainda é terço do meio', () => {
      expect(getPitchZone({ x: 0.5, y: 2 / 3 }).third).toBe(PitchThird.MIDDLE_THIRD);
    });

    it('y logo acima de 2/3 já é terço de ataque', () => {
      expect(getPitchZone({ x: 0.5, y: 2 / 3 + 0.001 }).third).toBe(PitchThird.ATTACKING_THIRD);
    });
  });

  describe('limites de corredor (eixo x)', () => {
    it.each([
      [0.2, PitchChannel.LEFT_CHANNEL],
      [0.2001, PitchChannel.LEFT_HALF_SPACE],
      [0.4, PitchChannel.LEFT_HALF_SPACE],
      [0.4001, PitchChannel.CENTRAL_CHANNEL],
      [0.6, PitchChannel.CENTRAL_CHANNEL],
      [0.6001, PitchChannel.RIGHT_HALF_SPACE],
      [0.8, PitchChannel.RIGHT_HALF_SPACE],
      [0.8001, PitchChannel.RIGHT_CHANNEL],
    ])('x = %f → %s', (x, expectedChannel) => {
      expect(getPitchZone({ x, y: 0.5 }).channel).toBe(expectedChannel);
    });
  });

  it.each([
    [{ x: -0.1, y: 0.5 }],
    [{ x: 1.1, y: 0.5 }],
    [{ x: 0.5, y: -0.1 }],
    [{ x: 0.5, y: 1.1 }],
    [{ x: NaN, y: 0.5 }],
  ])('lança erro para coordenada inválida: %o', (coordinate) => {
    expect(() => getPitchZone(coordinate)).toThrow(/Coordenada de campo inválida/);
  });
});

describe('invertPitchSide', () => {
  it('inverte x e y', () => {
    const inverted = invertPitchSide({ x: 0.2, y: 0.8 });
    expect(inverted.x).toBeCloseTo(0.8);
    expect(inverted.y).toBeCloseTo(0.2);
  });

  it('é a própria inversa — aplicar duas vezes retorna à coordenada original', () => {
    const original = { x: 0.37, y: 0.91 };
    expect(invertPitchSide(invertPitchSide(original))).toEqual(original);
  });

  it('inverte a zona resultante (defensivo vira ofensivo, esquerda vira direita)', () => {
    const zoneBefore = getPitchZone({ x: 0.1, y: 0.1 });
    const zoneAfter = getPitchZone(invertPitchSide({ x: 0.1, y: 0.1 }));

    expect(zoneBefore.third).toBe(PitchThird.DEFENSIVE_THIRD);
    expect(zoneAfter.third).toBe(PitchThird.ATTACKING_THIRD);
    expect(zoneBefore.channel).toBe(PitchChannel.LEFT_CHANNEL);
    expect(zoneAfter.channel).toBe(PitchChannel.RIGHT_CHANNEL);
  });
});

describe('getAllPitchZones', () => {
  it('retorna as 15 combinações de terço × corredor, sem duplicatas', () => {
    const zones = getAllPitchZones();

    expect(zones).toHaveLength(15);
    const unique = new Set(zones.map((z) => `${z.third}:${z.channel}`));
    expect(unique.size).toBe(15);
  });
});

describe('getNeighboringZones', () => {
  it('inclui a própria zona', () => {
    const zone = { third: PitchThird.MIDDLE_THIRD, channel: PitchChannel.CENTRAL_CHANNEL };
    const neighbors = getNeighboringZones(zone);

    expect(neighbors.some((z) => pitchZoneEquals(z, zone))).toBe(true);
  });

  it('zona central tem 9 vizinhas (grade 3×3 completa)', () => {
    const zone = { third: PitchThird.MIDDLE_THIRD, channel: PitchChannel.CENTRAL_CHANNEL };
    expect(getNeighboringZones(zone)).toHaveLength(9);
  });

  it('zona de canto tem menos vizinhas (grade cortada nas bordas)', () => {
    const zone = { third: PitchThird.DEFENSIVE_THIRD, channel: PitchChannel.LEFT_CHANNEL };
    expect(getNeighboringZones(zone)).toHaveLength(4);
  });
});

describe('pitchZoneEquals', () => {
  it('retorna true para zonas com mesmo terço e corredor', () => {
    const a = getPitchZone({ x: 0.1, y: 0.1 });
    const b = getPitchZone({ x: 0.15, y: 0.05 });
    expect(pitchZoneEquals(a, b)).toBe(true);
  });

  it('retorna false para zonas diferentes', () => {
    const a = getPitchZone({ x: 0.1, y: 0.1 });
    const b = getPitchZone({ x: 0.9, y: 0.9 });
    expect(pitchZoneEquals(a, b)).toBe(false);
  });
});
