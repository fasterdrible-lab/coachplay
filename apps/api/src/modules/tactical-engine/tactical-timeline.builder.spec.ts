import { EvaluatedDecisionRecord } from './evaluated-decision-record.type';
import { PrincipleAdherence } from './principle-adherence.type';
import { DecisionScore } from './decision-score.type';
import { buildTacticalTimeline } from './tactical-timeline.builder';

function score(total: number): DecisionScore {
  return {
    total,
    possessionSafety: total,
    progression: total,
    spaceCreation: total,
    defensiveBalance: total,
    futureOptions: total,
    pressureManagement: total,
  };
}

function record(overrides: Partial<EvaluatedDecisionRecord> = {}): EvaluatedDecisionRecord {
  return {
    timestampMs: 1000,
    action: { type: 'SAFE_PASS', estimatedRisk: 10, estimatedReward: 60 },
    pressureLevel: 'LOW',
    score: score(70),
    classification: 'ACCEPTABLE',
    principles: [],
    ...overrides,
  };
}

describe('buildTacticalTimeline', () => {
  it('ordena por timestampMs crescente, independente da ordem de entrada', () => {
    const timeline = buildTacticalTimeline([record({ timestampMs: 3000 }), record({ timestampMs: 1000 }), record({ timestampMs: 2000 })]);

    expect(timeline.map((entry) => entry.timestampMs)).toEqual([1000, 2000, 3000]);
  });

  it('não muta o array de entrada', () => {
    const records = [record({ timestampMs: 2000 }), record({ timestampMs: 1000 })];
    const original = [...records];

    buildTacticalTimeline(records);

    expect(records).toEqual(original);
  });

  it('projeta actionType, classification, scoreTotal e só os princípios violados', () => {
    const principles: PrincipleAdherence[] = [
      { principleId: 'KING_SAFETY', adhered: false },
      { principleId: 'SPACE_EXPANSION', adhered: true },
      { principleId: 'INITIATIVE', adhered: null },
    ];

    const [entry] = buildTacticalTimeline([
      record({ action: { type: 'PROGRESSIVE_PASS', estimatedRisk: 20, estimatedReward: 70 }, classification: 'GOOD', score: score(85), principles }),
    ]);

    expect(entry).toEqual({
      timestampMs: 1000,
      actionType: 'PROGRESSIVE_PASS',
      classification: 'GOOD',
      scoreTotal: 85,
      principlesViolated: ['KING_SAFETY'],
    });
  });

  it('lista vazia produz timeline vazia', () => {
    expect(buildTacticalTimeline([])).toEqual([]);
  });
});
