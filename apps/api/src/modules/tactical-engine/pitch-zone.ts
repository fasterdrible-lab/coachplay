import { PitchCoordinate, isValidPitchCoordinate } from './pitch-coordinate.type';

// Divisão estratégica do campo em terços (eixo y) e corredores (eixo x).
// Ver docs/tactical-engine-domain.md, seção 3 (PitchZone) — 15 zonas possíveis,
// sempre relativas ao ataque do time do usuário.
export enum PitchThird {
  DEFENSIVE_THIRD = 'DEFENSIVE_THIRD',
  MIDDLE_THIRD = 'MIDDLE_THIRD',
  ATTACKING_THIRD = 'ATTACKING_THIRD',
}

export enum PitchChannel {
  LEFT_CHANNEL = 'LEFT_CHANNEL',
  LEFT_HALF_SPACE = 'LEFT_HALF_SPACE',
  CENTRAL_CHANNEL = 'CENTRAL_CHANNEL',
  RIGHT_HALF_SPACE = 'RIGHT_HALF_SPACE',
  RIGHT_CHANNEL = 'RIGHT_CHANNEL',
}

export interface PitchZone {
  third: PitchThird;
  channel: PitchChannel;
}

const THIRD_BOUNDARIES: ReadonlyArray<{ upTo: number; third: PitchThird }> = [
  { upTo: 1 / 3, third: PitchThird.DEFENSIVE_THIRD },
  { upTo: 2 / 3, third: PitchThird.MIDDLE_THIRD },
  { upTo: 1, third: PitchThird.ATTACKING_THIRD },
];

const CHANNEL_BOUNDARIES: ReadonlyArray<{ upTo: number; channel: PitchChannel }> = [
  { upTo: 0.2, channel: PitchChannel.LEFT_CHANNEL },
  { upTo: 0.4, channel: PitchChannel.LEFT_HALF_SPACE },
  { upTo: 0.6, channel: PitchChannel.CENTRAL_CHANNEL },
  { upTo: 0.8, channel: PitchChannel.RIGHT_HALF_SPACE },
  { upTo: 1, channel: PitchChannel.RIGHT_CHANNEL },
];

/**
 * Classifica uma coordenada normalizada em uma zona do campo.
 * Lança erro para coordenadas fora de [0, 1] — o motor nunca corrige
 * silenciosamente uma coordenada inválida (ver docs/tactical-engine-domain.md).
 */
export function getPitchZone(position: PitchCoordinate): PitchZone {
  if (!isValidPitchCoordinate(position)) {
    throw new Error(
      `Coordenada de campo inválida: x=${position.x}, y=${position.y} (esperado [0, 1] em ambos os eixos)`,
    );
  }

  const third = THIRD_BOUNDARIES.find((b) => position.y <= b.upTo)!.third;
  const channel = CHANNEL_BOUNDARIES.find((b) => position.x <= b.upTo)!.channel;

  return { third, channel };
}

/**
 * Inverte a coordenada para o referencial do time adversário (ou para trocar
 * de lado no segundo tempo). Aplicar duas vezes retorna à coordenada original.
 */
export function invertPitchSide(position: PitchCoordinate): PitchCoordinate {
  return { x: 1 - position.x, y: 1 - position.y };
}

export function pitchZoneEquals(a: PitchZone, b: PitchZone): boolean {
  return a.third === b.third && a.channel === b.channel;
}

export const ALL_PITCH_THIRDS: readonly PitchThird[] = THIRD_BOUNDARIES.map((b) => b.third);
export const ALL_PITCH_CHANNELS: readonly PitchChannel[] = CHANNEL_BOUNDARIES.map((b) => b.channel);

/** As 15 zonas do campo (3 terços × 5 corredores), em ordem estável. */
export function getAllPitchZones(): PitchZone[] {
  return ALL_PITCH_THIRDS.flatMap((third) => ALL_PITCH_CHANNELS.map((channel) => ({ third, channel })));
}

/**
 * Zonas vizinhas de `zone` na grade 3×5 (vizinhança de Moore — inclui diagonais),
 * incluindo a própria `zone`. Usado para avaliações "ao redor de" um ponto (ex.:
 * superioridade numérica perto da bola), não só na zona exata.
 */
export function getNeighboringZones(zone: PitchZone): PitchZone[] {
  const thirdIndex = ALL_PITCH_THIRDS.indexOf(zone.third);
  const channelIndex = ALL_PITCH_CHANNELS.indexOf(zone.channel);
  const neighbors: PitchZone[] = [];

  for (const dThird of [-1, 0, 1]) {
    for (const dChannel of [-1, 0, 1]) {
      const third = ALL_PITCH_THIRDS[thirdIndex + dThird];
      const channel = ALL_PITCH_CHANNELS[channelIndex + dChannel];
      if (third && channel) neighbors.push({ third, channel });
    }
  }

  return neighbors;
}
