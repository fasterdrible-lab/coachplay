import { EvaluatedDecisionRecord } from './evaluated-decision-record.type';
import { PrincipleAdherence } from './principle-adherence.type';
import { DecisionScore } from './decision-score.type';
import { buildTacticalMatchReport } from './tactical-match-report.builder';

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

function principle(principleId: PrincipleAdherence['principleId'], adhered: boolean | null): PrincipleAdherence {
  return { principleId, adhered };
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

describe('buildTacticalMatchReport', () => {
  it('partida sem decisões avaliadas → relatório vazio, averageDecisionScore null (não 0)', () => {
    const report = buildTacticalMatchReport('match-1', []);

    expect(report.matchId).toBe('match-1');
    expect(report.decisionCount).toBe(0);
    expect(report.averageDecisionScore).toBeNull();
    expect(report.sequences).toEqual([]);
  });

  it('calcula averageDecisionScore a partir do total de cada decisão', () => {
    const report = buildTacticalMatchReport('match-1', [
      record({ score: score(80) }),
      record({ score: score(60) }),
      record({ score: score(70) }),
    ]);

    expect(report.averageDecisionScore).toBe(70);
  });

  it('conta classificationBreakdown para todas as 6 faixas, mesmo as que não ocorreram', () => {
    const report = buildTacticalMatchReport('match-1', [
      record({ classification: 'EXCELLENT' }),
      record({ classification: 'EXCELLENT' }),
      record({ classification: 'ERROR' }),
    ]);

    expect(report.classificationBreakdown).toEqual({
      EXCELLENT: 2,
      GOOD: 0,
      ACCEPTABLE: 0,
      RISKY: 0,
      ERROR: 1,
      MAJOR_ERROR: 0,
    });
  });

  it('agrega princípios seguidos/violados através das decisões, ordenados por frequência', () => {
    const report = buildTacticalMatchReport('match-1', [
      record({ principles: [principle('KING_SAFETY', false), principle('SPACE_EXPANSION', true)] }),
      record({ principles: [principle('KING_SAFETY', false), principle('OVERLOAD', null)] }),
      record({ principles: [principle('SPACE_EXPANSION', true)] }),
    ]);

    expect(report.principlesViolated).toEqual([{ principleId: 'KING_SAFETY', count: 2 }]);
    expect(report.principlesFollowed).toEqual([{ principleId: 'SPACE_EXPANSION', count: 2 }]);
  });

  it('deriva sequências táticas reusando detectTacticalSequences (Fase 3), sem duplicar lógica', () => {
    const report = buildTacticalMatchReport('match-1', [
      record({ timestampMs: 1000, action: { type: 'SWITCH_SIDE', estimatedRisk: 10, estimatedReward: 60 } }),
    ]);

    expect(report.sequences).toHaveLength(1);
    expect(report.sequences[0].type).toBe('SWITCH_OF_PLAY');
  });
});
