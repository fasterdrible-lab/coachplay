import { BuildCoachContext } from './build-coach.types';

/**
 * Monta o prompt do Coach de Build (Tarefa 14 — Ask Coach) — função pura, sem chamada de IA. Todo
 * fato no prompt vem do `BuildCoachContext` (já calculado pelo player-build-engine, Tarefa 5); a
 * IA só recebe instrução explícita de nunca recalcular/inventar além do que está listado. Mesmo
 * padrão de `buildSquadCoachPrompt` (Tarefa 10).
 */
export function buildBuildCoachPrompt(context: BuildCoachContext): string {
  const gainsText =
    context.topGains.length === 0
      ? 'Nenhum ganho de atributo (pontos já usados ou sem margem disponível nos atributos priorizados).'
      : context.topGains.map((g) => `${g.statKey}: +${g.delta}`).join(', ');

  const prioritizedText = context.prioritizedStats.length === 0 ? 'nenhum atributo específico' : context.prioritizedStats.join(', ');

  return `Você é um coach de evolução de jogadores de eFootball, em português. Um motor
determinístico (sem IA) já calculou como alocar os pontos de progressão de ${context.playerName}
(nível ${context.level}, posição ${context.position}) usando a estratégia ${context.strategy} —
os dados abaixo já estão decididos, você NUNCA recalcula a alocação nem inventa outro atributo ou
número.

Pontos de progressão usados: ${context.totalPointsUsed} de ${context.totalPointsAvailable} disponíveis.
Atributos priorizados pela estratégia ${context.strategy}: ${prioritizedText}
Maiores ganhos de atributo: ${gainsText}
Nota de adequação à posição ${context.position} (roleScore, 0-100): ${context.roleScore}

Em português, em até 3 frases curtas: explique por que essa alocação faz sentido pra estratégia
${context.strategy} e o que o roleScore indica sobre o encaixe do jogador na posição
${context.position} — baseado SÓ nos dados acima, nunca invente outro atributo, número ou
recomendação de compra/pack.`;
}
