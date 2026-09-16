export type NextBestActionType =
  | 'COMPLETE_ONBOARDING'
  | 'ADD_PLAYERS'
  | 'BUILD_SQUAD'
  | 'DO_LESSON'
  | 'ALL_CAUGHT_UP';

export interface NextBestActionSignals {
  onboardingCompleted: boolean;
  playersOwned: number;
  squadsSaved: number;
  /** Recomendação informada pelo Match Analysis (Tarefa 15) — `null` quando não há partida
   * analisada ainda, categoria sem módulo mapeado, ou a aula do módulo correspondente já está
   * bloqueada/concluída (ver `LearningService.getMatchInformedRecommendation`). */
  matchInformedLesson: { moduleTitle: string; lessonTitle: string; lessonId: string; matchCategory: string } | null;
  /** Próxima aula desbloqueada e não concluída na trilha do nível atual (`findNextUnlockedLesson`,
   * Tarefa 12/14) — só relevante quando `matchInformedLesson` é `null`. */
  nextSequentialLesson: { moduleTitle: string; lessonTitle: string; lessonId: string } | null;
}

export interface NextBestAction {
  type: NextBestActionType;
  reason: string;
  lessonId: string | null;
}

/**
 * Recomendação adaptativa (Tarefa 17) — "next best action": cadeia de prioridade 100%
 * determinística sobre sinais já agregados de todos os engines anteriores (Progresso, Tarefa 16;
 * Match Analysis, Tarefa 15; Academia, Tarefa 12). Função pura — quem monta `signals` decide o
 * quanto vale a pena consultar o banco (o chamador pode pular o cálculo de
 * `matchInformedLesson`/`nextSequentialLesson` quando uma condição anterior já decide a ação).
 *
 * Ordem de prioridade (da mais urgente pra "sem nada pendente"):
 * 1. Onboarding não concluído — sem isso, o resto do módulo (nível/objetivos) não tem base
 * 2. Elenco vazio — bloqueia Squad Builder, Economy Advisor e Coach de Elenco
 * 3. Nenhum elenco salvo — bloqueia Economy Advisor (teamNeedScore) e Coach de Elenco
 * 4. Aula informada pelo Match Analysis (diagnóstico a partir de partidas reais > sequência fixa)
 * 5. Próxima aula sequencial da trilha do nível atual
 * 6. Nada pendente — usuário em dia
 */
export function computeNextBestAction(signals: NextBestActionSignals): NextBestAction {
  if (!signals.onboardingCompleted) {
    return {
      type: 'COMPLETE_ONBOARDING',
      reason: 'Complete o onboarding do eFootball pra recebermos recomendações melhores pro seu nível.',
      lessonId: null,
    };
  }

  if (signals.playersOwned === 0) {
    return {
      type: 'ADD_PLAYERS',
      reason: 'Adicione seus primeiros jogadores em "Meus Jogadores" — é a base do Squad Builder, do Economy Advisor e do Coach de Elenco.',
      lessonId: null,
    };
  }

  if (signals.squadsSaved === 0) {
    return {
      type: 'BUILD_SQUAD',
      reason: 'Monte seu primeiro elenco no Squad Builder — ele desbloqueia recomendações melhores no Economy Advisor e no Coach de Elenco.',
      lessonId: null,
    };
  }

  if (signals.matchInformedLesson) {
    const { matchInformedLesson: lesson } = signals;
    return {
      type: 'DO_LESSON',
      reason: `Suas partidas analisadas mostram dificuldade em "${lesson.matchCategory}" — faça a aula "${lesson.moduleTitle} > ${lesson.lessonTitle}".`,
      lessonId: lesson.lessonId,
    };
  }

  if (signals.nextSequentialLesson) {
    const { nextSequentialLesson: lesson } = signals;
    return {
      type: 'DO_LESSON',
      reason: `Continue sua trilha na Academia: "${lesson.moduleTitle} > ${lesson.lessonTitle}".`,
      lessonId: lesson.lessonId,
    };
  }

  return {
    type: 'ALL_CAUGHT_UP',
    reason: 'Você está em dia com a Academia e já tem elenco montado! Volte depois de novas partidas analisadas ou avalie um pack no Economy Advisor.',
    lessonId: null,
  };
}
