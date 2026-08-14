import { DecisionContext } from './decision-context.type';
import { EvaluatedDecisionRecord } from './evaluated-decision-record.type';
import { PatternObservation } from './tactical-pattern.type';
import { generateActions } from './action-generator';
import { evaluateDecision } from './decision.evaluator';
import { evaluatePrincipleAdherence } from './principle-adherence.evaluator';
import { evaluatePressure } from './pressure.evaluator';
import { buildTacticalMatchReport } from './tactical-match-report.builder';
import { buildTacticalTimeline } from './tactical-timeline.builder';
import { buildDecisionDetail } from './decision-detail.builder';
import { detectTacticalPatterns } from './tactical-pattern.detector';
import { buildStrategicProfile } from './strategic-profile.builder';
import {
  counterAttackThreeVsTwoFixture,
  fullSquadFixture,
  lowConfidenceStateFixture,
  safeRecyclingFixture,
} from './tactical-fixtures';

// Ver TASKS.md (Fase 7, Tarefas 31-33) — testes de INTEGRAÇÃO (encadeiam vários módulos de
// fases diferentes com dados reais de fixtures, ao contrário dos specs unitários que isolam uma
// função por vez) e de PERFORMANCE (guarda de regressão grave, não benchmark de precisão).

// Reproduz o fluxo que um futuro worker faria: gera candidatas, avalia a primeira como a "ação
// real" (não importa qual, só que o pipeline inteiro rode com um resultado de verdade), julga
// princípios e monta o record comum aos builders de saída (Fase 5).
function evaluateFirstCandidate(context: DecisionContext, timestampMs: number): EvaluatedDecisionRecord | null {
  const [firstCandidate] = generateActions(context);
  if (!firstCandidate) return null;

  const evaluation = evaluateDecision(context, {
    type: firstCandidate.type,
    targetPlayerId: firstCandidate.targetPlayerId,
  });
  if (!evaluation) return null;

  const principles = evaluatePrincipleAdherence(context, evaluation.actualAction, evaluation.actualScore);
  const ballCarrier = context.gameState.userPlayers.find((player) => player.trackingId === context.ballCarrierId)!;
  const pressureLevel = evaluatePressure(ballCarrier, context.gameState.opponentPlayers).level;

  return {
    timestampMs,
    action: evaluation.actualAction,
    pressureLevel,
    score: evaluation.actualScore,
    classification: evaluation.classification,
    principles,
  };
}

describe('Tactical Engine — pipeline de ponta a ponta', () => {
  it('uma decisão avaliada flui corretamente por relatório, timeline e detalhe (Fases 3-5)', () => {
    const record = evaluateFirstCandidate(safeRecyclingFixture(), 5000);
    expect(record).not.toBeNull();

    const report = buildTacticalMatchReport('match-1', [record!]);
    expect(report.decisionCount).toBe(1);
    expect(report.classificationBreakdown[record!.classification]).toBe(1);

    const timeline = buildTacticalTimeline([record!]);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].timestampMs).toBe(5000);
    expect(timeline[0].actionType).toBe(record!.action.type);

    const detail = buildDecisionDetail(
      record!.timestampMs,
      {
        actualAction: record!.action,
        actualScore: record!.score,
        scoreDifference: 0,
        classification: record!.classification,
      },
      record!.principles,
    );
    expect(detail.principles).toBe(record!.principles);
  });

  it('múltiplas partidas do mesmo usuário alimentam padrões (Fase 4) e perfil estratégico (Fase 4) sem quebrar', () => {
    const scenarios: Array<[string, () => DecisionContext]> = [
      ['match-1', safeRecyclingFixture],
      ['match-2', safeRecyclingFixture],
      ['match-3', safeRecyclingFixture],
      ['match-4', counterAttackThreeVsTwoFixture],
    ];

    const observations: PatternObservation[] = [];
    let occurredAt = new Date('2026-08-01');

    for (const [matchId, buildFixture] of scenarios) {
      const record = evaluateFirstCandidate(buildFixture(), 1000);
      if (!record) continue;

      for (const adherence of record.principles) {
        if (adherence.adhered === null) continue;
        observations.push({ matchId, occurredAt, principleId: adherence.principleId, adhered: adherence.adhered });
      }
      occurredAt = new Date(occurredAt.getTime() + 86_400_000);
    }

    const patterns = detectTacticalPatterns(observations);
    const profile = buildStrategicProfile(patterns);

    // Não afirma um padrão específico (depende só dos fixtures, que podem mudar) — só que o
    // pipeline inteiro (avaliação → princípios → padrões → perfil) produz uma estrutura
    // internamente consistente, sem lançar.
    expect(profile.sampleSize).toBe(patterns.reduce((sum, pattern) => sum + pattern.frequency, 0));
  });

  it('confiança insuficiente interrompe o pipeline antes de qualquer avaliação (Tarefa 29/30)', () => {
    expect(evaluateFirstCandidate(lowConfidenceStateFixture(), 1000)).toBeNull();
  });

  it('performance (Tarefa 31): 200 decisões avaliadas sobre um elenco completo (22 jogadores) em tempo hábil', () => {
    const start = Date.now();

    for (let i = 0; i < 200; i++) {
      evaluateFirstCandidate(fullSquadFixture(), i);
    }

    const elapsedMs = Date.now() - start;
    // Limite generoso — não é um benchmark de precisão, só uma guarda de regressão grave (ex.:
    // alguém introduzir um loop O(n²) desnecessário sobre os 22 jogadores de um avaliador novo).
    expect(elapsedMs).toBeLessThan(3000);
  });
});
