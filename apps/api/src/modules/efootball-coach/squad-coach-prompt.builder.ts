import { SquadCoachContext } from './squad-coach.types';

/**
 * Monta o prompt do Coach de Elenco (Tarefa 10) — função pura, sem chamada de IA. Todo fato no
 * prompt vem do `SquadCoachContext` (já calculado pelo squad-builder.engine, Tarefa 9); a IA só
 * recebe instrução explícita de nunca recalcular/inventar além do que está listado.
 */
export function buildSquadCoachPrompt(context: SquadCoachContext): string {
  const startersText =
    context.startingXI.length === 0
      ? 'Nenhum titular definido.'
      : context.startingXI
          .map((p) => `${p.slot} (${p.position}): ${p.playerName} [overall ${p.overallBase}]`)
          .join('\n');

  const weakText =
    context.weakPositions.length === 0
      ? 'Nenhuma posição fraca — elenco bem distribuído para esta formação.'
      : context.weakPositions
          .map((w) =>
            w.reason === 'EMPTY'
              ? `${w.slot} (${w.position}): vaga sem nenhum jogador compatível no elenco`
              : `${w.slot} (${w.position}): preenchida por um jogador fora da posição ideal`,
          )
          .join('\n');

  const compositionText = Object.entries(context.rosterCompositionByGroup)
    .sort((a, b) => b[1] - a[1])
    .map(([group, count]) => `${group}: ${count}`)
    .join(', ');

  return `Você é um coach de elenco de eFootball, em português. Um motor determinístico (sem IA)
já escalou o time na formação ${context.formationCode} — os dados abaixo já estão decididos, você
NUNCA escolhe jogador nem recalcula nada, só explica o resultado já pronto.

Titulares:
${startersText}

Posições fracas (identificadas pelo motor, não por você):
${weakText}

Composição do elenco por grupo posicional: ${compositionText || 'sem dados'}

Em português, em até 3 frases curtas: explique o principal ponto forte do elenco pra essa
formação e, se houver posição fraca, recomende objetivamente que tipo de jogador o usuário
deveria priorizar — baseado SÓ nas posições fracas listadas acima, nunca invente outra
recomendação nem outra posição fraca.`;
}
