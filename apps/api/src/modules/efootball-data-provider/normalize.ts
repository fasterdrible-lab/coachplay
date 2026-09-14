import { normalizePlayerName } from '../players/player-name.util';
import { NormalizedPlayerRecord, RawPlayerRecord } from './raw-player-record.type';

/** Passo "normalize" do pipeline — mapeamento determinístico, sem IA. */
export function normalizeRecord(raw: RawPlayerRecord): NormalizedPlayerRecord {
  return { ...raw, normalizedName: normalizePlayerName(raw.name) };
}
