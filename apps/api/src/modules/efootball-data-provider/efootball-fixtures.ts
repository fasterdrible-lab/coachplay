import { RawPlayerRecord } from './raw-player-record.type';

const POSITIONS = ['GK', 'CB', 'DMF', 'CMF', 'LWF', 'RWF', 'CF'];

/**
 * Fixture SINTÉTICA para testar o pipeline efootball-data-provider (Tarefa 4) — nomes/atributos
 * gerados deterministicamente, NUNCA dados reais de catálogo (ver docs/efootball-architecture.md,
 * "Regra de dados": atributos de jogador só entram no banco vindos de fonte validada; isto aqui
 * só existe para exercitar fetch→normalize→validate→version→import em teste).
 */
export function buildFixturePlayers(count: number): RawPlayerRecord[] {
  return Array.from({ length: count }, (_, i) => {
    const index = String(i + 1).padStart(3, '0');
    return {
      externalId: `fixture-player-${index}`,
      name: `Fixture Player ${index}`,
      nationality: 'FIC',
      preferredFoot: i % 2 === 0 ? 'right' : 'left',
      height: 170 + (i % 20),
      cards: [
        {
          externalId: `fixture-card-${index}-standard`,
          cardType: 'standard',
          version: '1.0',
          overallBase: 70 + (i % 20),
          maxLevel: 99,
          position: POSITIONS[i % POSITIONS.length],
          stats: { offensive_awareness: 60 + (i % 30), dribbling: 60 + (i % 30) },
          skills: i % 5 === 0 ? ['long_range_drive'] : [],
          playStyles: [],
        },
      ],
    };
  });
}
