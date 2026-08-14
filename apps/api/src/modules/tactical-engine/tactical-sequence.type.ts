// Ver docs/tactical-engine-domain.md (TacticalSequence) e Tarefa 17 do plano original —
// cadeia de decisões consecutivas que forma um padrão tático reconhecível dentro de UMA
// partida. Diferente de TacticalPattern (Tarefa 21, Fase 4): aquele é recorrência através de
// MÚLTIPLAS partidas do mesmo usuário, este é uma sequência local dentro de uma partida.
//
// DEFENSIVE_RECOVERY está listado no vocabulário (fiel ao plano original) mas
// tactical-sequence.detector.ts não o detecta ainda: o ActionGenerator (Tarefa 12) só modela
// decisões do time COM a posse (o portador da bola do usuário), nunca ações defensivas do
// time sem a bola — não há dado de onde inferir "recuperação defensiva" com honestidade.
export type TacticalSequenceType =
  | 'CIRCULATION_UNDER_PRESSURE'
  | 'SWITCH_OF_PLAY'
  | 'CENTRAL_PROGRESSION'
  | 'PRESSURE_ESCAPE'
  | 'DANGEROUS_LOSS'
  | 'DEFENSIVE_RECOVERY';

export interface TacticalSequence {
  type: TacticalSequenceType;
  startTimestampMs: number;
  endTimestampMs: number;
  decisionCount: number;
  description: string;
}
