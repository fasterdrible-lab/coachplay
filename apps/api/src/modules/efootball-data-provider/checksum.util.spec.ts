import { computeBatchChecksum } from './checksum.util';
import { NormalizedPlayerRecord } from './raw-player-record.type';

const record = (externalId: string, overallBase: number): NormalizedPlayerRecord => ({
  externalId,
  name: `Player ${externalId}`,
  normalizedName: `player ${externalId}`,
  cards: [{ externalId: `${externalId}-card`, cardType: 'standard', version: '1.0', overallBase, maxLevel: 99, position: 'CF' }],
});

describe('computeBatchChecksum', () => {
  it('é determinístico para o mesmo lote', () => {
    const batch = [record('a', 80), record('b', 75)];

    expect(computeBatchChecksum(batch)).toBe(computeBatchChecksum(batch));
  });

  it('não depende da ordem dos registros no array', () => {
    const batch1 = [record('a', 80), record('b', 75)];
    const batch2 = [record('b', 75), record('a', 80)];

    expect(computeBatchChecksum(batch1)).toBe(computeBatchChecksum(batch2));
  });

  it('muda quando um atributo de carta muda', () => {
    const batch1 = [record('a', 80)];
    const batch2 = [record('a', 81)];

    expect(computeBatchChecksum(batch1)).not.toBe(computeBatchChecksum(batch2));
  });
});
