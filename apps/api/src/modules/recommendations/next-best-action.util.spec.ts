import { computeNextBestAction, NextBestActionSignals } from './next-best-action.util';

describe('computeNextBestAction (Tarefa 17 — cadeia de prioridade)', () => {
  const baseSignals: NextBestActionSignals = {
    onboardingCompleted: true,
    playersOwned: 3,
    squadsSaved: 1,
    matchInformedLesson: null,
    nextSequentialLesson: null,
  };

  it('onboarding não concluído tem prioridade sobre tudo', () => {
    const result = computeNextBestAction({ ...baseSignals, onboardingCompleted: false, playersOwned: 0, squadsSaved: 0 });

    expect(result.type).toBe('COMPLETE_ONBOARDING');
    expect(result.lessonId).toBeNull();
  });

  it('sem jogadores no elenco, prioriza adicionar jogadores sobre montar squad e aulas', () => {
    const result = computeNextBestAction({
      ...baseSignals,
      playersOwned: 0,
      squadsSaved: 0,
      nextSequentialLesson: { moduleTitle: 'Passe', lessonTitle: 'Aula', lessonId: 'l1' },
    });

    expect(result.type).toBe('ADD_PLAYERS');
  });

  it('com jogadores mas sem elenco salvo, prioriza montar squad sobre aulas', () => {
    const result = computeNextBestAction({
      ...baseSignals,
      squadsSaved: 0,
      nextSequentialLesson: { moduleTitle: 'Passe', lessonTitle: 'Aula', lessonId: 'l1' },
    });

    expect(result.type).toBe('BUILD_SQUAD');
  });

  it('onboarding/elenco/squad em dia: prioriza a aula informada pelo Match Analysis sobre a sequencial', () => {
    const result = computeNextBestAction({
      ...baseSignals,
      matchInformedLesson: { moduleTitle: 'Passe', lessonTitle: 'Passe certo', lessonId: 'l1', matchCategory: 'passing' },
      nextSequentialLesson: { moduleTitle: 'Fundamentos', lessonTitle: 'Intro', lessonId: 'l2' },
    });

    expect(result).toEqual({
      type: 'DO_LESSON',
      reason: expect.stringContaining('passing'),
      lessonId: 'l1',
    });
  });

  it('sem aula informada pelo Match Analysis, cai pra próxima aula sequencial', () => {
    const result = computeNextBestAction({
      ...baseSignals,
      nextSequentialLesson: { moduleTitle: 'Fundamentos', lessonTitle: 'Intro', lessonId: 'l2' },
    });

    expect(result).toEqual({
      type: 'DO_LESSON',
      reason: expect.stringContaining('Fundamentos > Intro'),
      lessonId: 'l2',
    });
  });

  it('nada pendente: usuário em dia', () => {
    const result = computeNextBestAction(baseSignals);

    expect(result).toEqual({ type: 'ALL_CAUGHT_UP', reason: expect.any(String), lessonId: null });
  });
});
