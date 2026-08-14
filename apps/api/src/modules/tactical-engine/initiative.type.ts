// Ver docs/tactical-engine-domain.md e TASKS.md (Fase 4, Tarefa 19) — princípio INITIATIVE do
// catálogo (strategic-principle.type.ts), traduzido para um indicador geométrico por instante.
export type InitiativeHolder = 'user' | 'opponent' | 'neutral';

export interface InitiativeState {
  holder: InitiativeHolder;
  score: number; // 0-100, do ponto de vista do usuário (100 = domínio total, 0 = adversário domina)
  territorialDominance: number; // 0-100, posicionamento médio avançado do usuário vs. adversário
  possessionFactor: number; // 0-100, contribuição de quem tem a bola no instante
}
