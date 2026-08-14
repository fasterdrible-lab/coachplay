import { PitchChannel } from './pitch-zone';
import { NumericalAdvantage } from './numerical-advantage.type';

// Ver docs/tactical-engine-domain.md e TASKS.md (Fase 4, Tarefa 20) — princípio OVERLOAD do
// catálogo (strategic-principle.type.ts) aplicado à mudança de lado de jogo (switch of play):
// compara a superioridade numérica do lado atual da bola com a do lado espelhado do campo.
export interface SwitchOpportunity {
  currentChannel: PitchChannel;
  targetChannel: PitchChannel;
  currentSideAdvantage: NumericalAdvantage;
  targetSideAdvantage: NumericalAdvantage;
  // 0-100: quão mais vantajoso é o lado oposto em relação ao lado atual. 50 = equivalentes;
  // acima de 50, o lado oposto compensa mais; abaixo, o lado atual já é o melhor.
  value: number;
}
