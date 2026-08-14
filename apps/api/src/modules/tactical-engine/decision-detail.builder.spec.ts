import { DecisionEvaluation } from './decision-evaluation.type';
import { PrincipleAdherence } from './principle-adherence.type';
import { TacticalDecisionFeedback } from './tactical-decision-feedback.type';
import { buildDecisionDetail } from './decision-detail.builder';

function buildEvaluation(): DecisionEvaluation {
  return {
    actualAction: { type: 'SAFE_PASS', estimatedRisk: 10, estimatedReward: 60 },
    actualScore: {
      total: 70,
      possessionSafety: 70,
      progression: 70,
      spaceCreation: 70,
      defensiveBalance: 70,
      futureOptions: 70,
      pressureManagement: 70,
    },
    scoreDifference: -5,
    classification: 'ACCEPTABLE',
  };
}

describe('buildDecisionDetail', () => {
  it('combina timestamp, avaliação e princípios num único objeto', () => {
    const evaluation = buildEvaluation();
    const principles: PrincipleAdherence[] = [{ principleId: 'KING_SAFETY', adhered: true }];

    const detail = buildDecisionDetail(1500, evaluation, principles);

    expect(detail).toEqual({ timestampMs: 1500, evaluation, principles, feedback: undefined });
  });

  it('inclui feedback quando fornecido', () => {
    const evaluation = buildEvaluation();
    const feedback: TacticalDecisionFeedback = {
      explanation: 'Passe seguro, mas havia opção melhor pelo lado.',
      classification: 'ACCEPTABLE',
      scoreDifference: -5,
      principlesFollowed: ['KING_SAFETY'],
      principlesViolated: [],
    };

    const detail = buildDecisionDetail(1500, evaluation, [], feedback);

    expect(detail.feedback).toBe(feedback);
  });
});
