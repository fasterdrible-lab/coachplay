import { LastFeedbackDelivery } from './feedback-priority.type';
import { computeFeedbackPriority, shouldDeliverLiveFeedback } from './feedback-priority.evaluator';

describe('computeFeedbackPriority', () => {
  it('mapeia cada classificação para a prioridade esperada', () => {
    expect(computeFeedbackPriority('MAJOR_ERROR')).toBe('CRITICAL');
    expect(computeFeedbackPriority('ERROR')).toBe('HIGH');
    expect(computeFeedbackPriority('RISKY')).toBe('MEDIUM');
    expect(computeFeedbackPriority('EXCELLENT')).toBe('MEDIUM');
    expect(computeFeedbackPriority('GOOD')).toBe('LOW');
    expect(computeFeedbackPriority('ACCEPTABLE')).toBe('LOW');
  });
});

describe('shouldDeliverLiveFeedback', () => {
  it('LOW nunca é entregue ao vivo, mesmo sem entrega anterior', () => {
    expect(shouldDeliverLiveFeedback('LOW', null, 100_000)).toBe(false);
  });

  it('sem entrega anterior, qualquer prioridade elegível (MEDIUM+) é entregue imediatamente', () => {
    expect(shouldDeliverLiveFeedback('MEDIUM', null, 0)).toBe(true);
    expect(shouldDeliverLiveFeedback('HIGH', null, 0)).toBe(true);
    expect(shouldDeliverLiveFeedback('CRITICAL', null, 0)).toBe(true);
  });

  it('MEDIUM respeita cooldown de 60s desde a última entrega MEDIUM', () => {
    const lastDelivery: LastFeedbackDelivery = { priority: 'MEDIUM', atMs: 100_000 };

    expect(shouldDeliverLiveFeedback('MEDIUM', lastDelivery, 100_000 + 59_000)).toBe(false);
    expect(shouldDeliverLiveFeedback('MEDIUM', lastDelivery, 100_000 + 60_000)).toBe(true);
  });

  it('HIGH respeita cooldown de 30s desde a última entrega HIGH', () => {
    const lastDelivery: LastFeedbackDelivery = { priority: 'HIGH', atMs: 100_000 };

    expect(shouldDeliverLiveFeedback('HIGH', lastDelivery, 100_000 + 29_000)).toBe(false);
    expect(shouldDeliverLiveFeedback('HIGH', lastDelivery, 100_000 + 30_000)).toBe(true);
  });

  it('uma entrega HIGH recente também segura a próxima MEDIUM (usa o maior cooldown entre as duas)', () => {
    const lastDelivery: LastFeedbackDelivery = { priority: 'HIGH', atMs: 100_000 };

    // MEDIUM sozinho já liberaria em +60s, mas o cooldown de HIGH (30s) não é o maior aqui —
    // o maior é o de MEDIUM (60s), então MEDIUM só libera em +60s mesmo vindo depois de um HIGH.
    expect(shouldDeliverLiveFeedback('MEDIUM', lastDelivery, 100_000 + 45_000)).toBe(false);
    expect(shouldDeliverLiveFeedback('MEDIUM', lastDelivery, 100_000 + 60_000)).toBe(true);
  });

  it('uma entrega MEDIUM recente segura a próxima HIGH até o cooldown de MEDIUM (o maior dos dois) passar', () => {
    const lastDelivery: LastFeedbackDelivery = { priority: 'MEDIUM', atMs: 100_000 };

    // HIGH sozinho liberaria em +30s, mas o maior cooldown entre HIGH (30s) e MEDIUM (60s) é 60s.
    expect(shouldDeliverLiveFeedback('HIGH', lastDelivery, 100_000 + 30_000)).toBe(false);
    expect(shouldDeliverLiveFeedback('HIGH', lastDelivery, 100_000 + 60_000)).toBe(true);
  });

  it('CRITICAL nunca é bloqueado pelo cooldown de outra prioridade — só pelo próprio (15s)', () => {
    const lastDelivery: LastFeedbackDelivery = { priority: 'MEDIUM', atMs: 100_000 };

    // Cooldown de MEDIUM (60s) ainda não passou, mas CRITICAL ignora isso.
    expect(shouldDeliverLiveFeedback('CRITICAL', lastDelivery, 100_000 + 15_000)).toBe(true);
    expect(shouldDeliverLiveFeedback('CRITICAL', lastDelivery, 100_000 + 14_000)).toBe(false);
  });

  it('duas entregas CRITICAL seguidas ainda respeitam os 15s entre si', () => {
    const lastDelivery: LastFeedbackDelivery = { priority: 'CRITICAL', atMs: 100_000 };

    expect(shouldDeliverLiveFeedback('CRITICAL', lastDelivery, 100_000 + 14_999)).toBe(false);
    expect(shouldDeliverLiveFeedback('CRITICAL', lastDelivery, 100_000 + 15_000)).toBe(true);
  });
});
