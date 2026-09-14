import { createHash } from 'crypto';
import { NormalizedPlayerRecord } from './raw-player-record.type';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Passo "version" do pipeline — checksum estável do lote (ordem de chaves/registros não afeta
 * o resultado), usado para identificar reimportações idênticas do mesmo lote. */
export function computeBatchChecksum(records: NormalizedPlayerRecord[]): string {
  const sorted = [...records].sort((a, b) => a.externalId.localeCompare(b.externalId));
  return createHash('sha256').update(stableStringify(sorted)).digest('hex');
}
