// Ver docs/tactical-engine-domain.md e TASKS.md (Fase 4, Tarefa 18) — catálogo de princípios
// estratégicos inspirados em xadrez, traduzidos para futebol digital. Cada entrada é dado
// estático (nome + origem no xadrez + tradução para futebol); a avaliação de aderência a cada
// princípio, dado um DecisionContext real, vive em principle-adherence.evaluator.ts (não aqui —
// este arquivo é só o catálogo, Tarefa 18 propriamente dita).
export type StrategicPrincipleId =
  | 'CENTRAL_CONTROL'
  | 'PIECE_ACTIVITY'
  | 'KING_SAFETY'
  | 'SPACE_EXPANSION'
  | 'INITIATIVE'
  | 'PROPHYLAXIS'
  | 'OVERLOAD'
  | 'WEAKNESS_EXPLOITATION';

export interface StrategicPrinciple {
  id: StrategicPrincipleId;
  name: string;
  chessOrigin: string;
  footballTranslation: string;
}

export const STRATEGIC_PRINCIPLE_CATALOG: Readonly<Record<StrategicPrincipleId, StrategicPrinciple>> = {
  CENTRAL_CONTROL: {
    id: 'CENTRAL_CONTROL',
    name: 'Controle do centro',
    chessOrigin: 'Controlar as casas centrais (e4/d4/e5/d5) maximiza a mobilidade das peças.',
    footballTranslation:
      'Progredir a bola pelo corredor central/meio-espaços em vez de jogar sempre pelas pontas, quando a progressão compensa.',
  },
  PIECE_ACTIVITY: {
    id: 'PIECE_ACTIVITY',
    name: 'Atividade das peças',
    chessOrigin: 'Peças passivas (presas na primeira fileira) não contribuem para o jogo.',
    footballTranslation: 'Evitar segurar a bola (HOLD) sem necessidade quando não há pressão real a gerenciar.',
  },
  KING_SAFETY: {
    id: 'KING_SAFETY',
    name: 'Segurança do rei',
    chessOrigin: 'Nenhum ataque compensa se o próprio rei fica exposto a um xeque-mate.',
    footballTranslation: 'Manter equilíbrio defensivo (jogadores atrás da bola, cobertura central) mesmo ao atacar.',
  },
  SPACE_EXPANSION: {
    id: 'SPACE_EXPANSION',
    name: 'Expansão de espaço',
    chessOrigin: 'Mais espaço no tabuleiro amplia as opções futuras e restringe as do adversário.',
    footballTranslation: 'Direcionar a ação para zonas com espaço livre real, não para onde o adversário já está.',
  },
  INITIATIVE: {
    id: 'INITIATIVE',
    name: 'Iniciativa',
    chessOrigin: 'Ditar o ritmo do jogo, forçando o adversário a reagir em vez de propor.',
    footballTranslation: 'Manter domínio territorial e propositivo do jogo (ver initiative.evaluator.ts, Tarefa 19).',
  },
  PROPHYLAXIS: {
    id: 'PROPHYLAXIS',
    name: 'Profilaxia',
    chessOrigin: 'Neutralizar o plano do adversário antes de executar o próprio, quando sob ameaça real.',
    footballTranslation: 'Sob pressão alta/crítica, priorizar segurança de posse (reciclar/passe seguro) em vez de arriscar.',
  },
  OVERLOAD: {
    id: 'OVERLOAD',
    name: 'Sobrecarga',
    chessOrigin: 'Atacar um defensor que protege duas coisas ao mesmo tempo o sobrecarrega.',
    footballTranslation: 'Explorar zonas com superioridade numérica do usuário em vez de ignorá-las (ver Tarefa 20).',
  },
  WEAKNESS_EXPLOITATION: {
    id: 'WEAKNESS_EXPLOITATION',
    name: 'Exploração de fraquezas',
    chessOrigin: 'Casas fracas (sem controle de peão adversário) são alvos prioritários de ocupação.',
    footballTranslation: 'Atacar espaço livre no último terço, não só progredir por progredir.',
  },
};

export function getStrategicPrinciple(id: StrategicPrincipleId): StrategicPrinciple {
  return STRATEGIC_PRINCIPLE_CATALOG[id];
}

export function getAllStrategicPrinciples(): StrategicPrinciple[] {
  return Object.values(STRATEGIC_PRINCIPLE_CATALOG);
}
