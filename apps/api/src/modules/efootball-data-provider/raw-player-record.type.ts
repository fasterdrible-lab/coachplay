/** Formato bruto esperado de uma fonte de dados (fixture local ou, futuramente, uma fonte real
 * aprovada — ver docs/efootball-architecture.md, risco 1: nenhuma fonte real está integrada
 * ainda). Nunca preenchido por IA generativa. */
export interface RawPlayerCardRecord {
  externalId: string;
  cardType: string;
  version: string;
  overallBase: number;
  maxLevel: number;
  position: string;
  imageUrl?: string;
  releaseDate?: string;
  stats?: Record<string, number>;
  skills?: string[];
  playStyles?: Array<{ key: string; tier?: string }>;
}

export interface RawPlayerRecord {
  externalId: string;
  name: string;
  nationality?: string;
  preferredFoot?: string;
  height?: number;
  cards: RawPlayerCardRecord[];
}

export interface NormalizedPlayerRecord extends RawPlayerRecord {
  normalizedName: string;
}
