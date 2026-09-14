// Catálogo de formações do Squad Builder (Tarefa 9) — layout padrão de futebol (conhecimento
// genérico do esporte, não um dump de dados proprietários do eFootball). Cada formação tem
// exatamente 11 slots, exatamente 1 GK — é essa invariante que garante que o engine nunca escala
// 2 goleiros simultaneamente (nenhuma formação aqui define 2 slots GK).
export const FORMATIONS_CATALOG_VERSION = '1.0.0';

export interface FormationSlotDef {
  slot: string;
  position: string;
  x: number;
  y: number;
}

export interface FormationDef {
  code: string;
  name: string;
  slots: FormationSlotDef[];
}

// x/y normalizados (0-1) — x: esquerda(0)→direita(1), y: defesa própria(0)→ataque(1).
export const FORMATIONS: FormationDef[] = [
  {
    code: '4-3-3',
    name: '4-3-3',
    slots: [
      { slot: 'GK', position: 'GK', x: 0.5, y: 0.03 },
      { slot: 'LB', position: 'LB', x: 0.15, y: 0.22 },
      { slot: 'CB1', position: 'CB', x: 0.38, y: 0.18 },
      { slot: 'CB2', position: 'CB', x: 0.62, y: 0.18 },
      { slot: 'RB', position: 'RB', x: 0.85, y: 0.22 },
      { slot: 'DMF', position: 'DMF', x: 0.5, y: 0.4 },
      { slot: 'CM1', position: 'CMF', x: 0.32, y: 0.52 },
      { slot: 'CM2', position: 'CMF', x: 0.68, y: 0.52 },
      { slot: 'LWF', position: 'LWF', x: 0.12, y: 0.78 },
      { slot: 'CF', position: 'CF', x: 0.5, y: 0.88 },
      { slot: 'RWF', position: 'RWF', x: 0.88, y: 0.78 },
    ],
  },
  {
    code: '4-2-3-1',
    name: '4-2-3-1',
    slots: [
      { slot: 'GK', position: 'GK', x: 0.5, y: 0.03 },
      { slot: 'LB', position: 'LB', x: 0.15, y: 0.22 },
      { slot: 'CB1', position: 'CB', x: 0.38, y: 0.18 },
      { slot: 'CB2', position: 'CB', x: 0.62, y: 0.18 },
      { slot: 'RB', position: 'RB', x: 0.85, y: 0.22 },
      { slot: 'DM1', position: 'DMF', x: 0.35, y: 0.4 },
      { slot: 'DM2', position: 'DMF', x: 0.65, y: 0.4 },
      { slot: 'LMF', position: 'LMF', x: 0.15, y: 0.65 },
      { slot: 'AMF', position: 'AMF', x: 0.5, y: 0.68 },
      { slot: 'RMF', position: 'RMF', x: 0.85, y: 0.65 },
      { slot: 'CF', position: 'CF', x: 0.5, y: 0.88 },
    ],
  },
  {
    code: '4-2-1-3',
    name: '4-2-1-3',
    slots: [
      { slot: 'GK', position: 'GK', x: 0.5, y: 0.03 },
      { slot: 'LB', position: 'LB', x: 0.15, y: 0.22 },
      { slot: 'CB1', position: 'CB', x: 0.38, y: 0.18 },
      { slot: 'CB2', position: 'CB', x: 0.62, y: 0.18 },
      { slot: 'RB', position: 'RB', x: 0.85, y: 0.22 },
      { slot: 'DM1', position: 'DMF', x: 0.35, y: 0.4 },
      { slot: 'DM2', position: 'DMF', x: 0.65, y: 0.4 },
      { slot: 'AMF', position: 'AMF', x: 0.5, y: 0.6 },
      { slot: 'LWF', position: 'LWF', x: 0.12, y: 0.8 },
      { slot: 'CF', position: 'CF', x: 0.5, y: 0.88 },
      { slot: 'RWF', position: 'RWF', x: 0.88, y: 0.8 },
    ],
  },
  {
    code: '4-4-2',
    name: '4-4-2',
    slots: [
      { slot: 'GK', position: 'GK', x: 0.5, y: 0.03 },
      { slot: 'LB', position: 'LB', x: 0.15, y: 0.22 },
      { slot: 'CB1', position: 'CB', x: 0.38, y: 0.18 },
      { slot: 'CB2', position: 'CB', x: 0.62, y: 0.18 },
      { slot: 'RB', position: 'RB', x: 0.85, y: 0.22 },
      { slot: 'LMF', position: 'LMF', x: 0.15, y: 0.5 },
      { slot: 'CM1', position: 'CMF', x: 0.38, y: 0.48 },
      { slot: 'CM2', position: 'CMF', x: 0.62, y: 0.48 },
      { slot: 'RMF', position: 'RMF', x: 0.85, y: 0.5 },
      { slot: 'CF1', position: 'CF', x: 0.38, y: 0.85 },
      { slot: 'CF2', position: 'CF', x: 0.62, y: 0.85 },
    ],
  },
  {
    code: '3-4-3',
    name: '3-4-3',
    slots: [
      { slot: 'GK', position: 'GK', x: 0.5, y: 0.03 },
      { slot: 'CB1', position: 'CB', x: 0.25, y: 0.18 },
      { slot: 'CB2', position: 'CB', x: 0.5, y: 0.15 },
      { slot: 'CB3', position: 'CB', x: 0.75, y: 0.18 },
      { slot: 'LMF', position: 'LMF', x: 0.12, y: 0.48 },
      { slot: 'CM1', position: 'CMF', x: 0.38, y: 0.45 },
      { slot: 'CM2', position: 'CMF', x: 0.62, y: 0.45 },
      { slot: 'RMF', position: 'RMF', x: 0.88, y: 0.48 },
      { slot: 'LWF', position: 'LWF', x: 0.15, y: 0.8 },
      { slot: 'CF', position: 'CF', x: 0.5, y: 0.88 },
      { slot: 'RWF', position: 'RWF', x: 0.85, y: 0.8 },
    ],
  },
  {
    code: '3-5-2',
    name: '3-5-2',
    slots: [
      { slot: 'GK', position: 'GK', x: 0.5, y: 0.03 },
      { slot: 'CB1', position: 'CB', x: 0.25, y: 0.18 },
      { slot: 'CB2', position: 'CB', x: 0.5, y: 0.15 },
      { slot: 'CB3', position: 'CB', x: 0.75, y: 0.18 },
      { slot: 'LB', position: 'LB', x: 0.1, y: 0.45 },
      { slot: 'RB', position: 'RB', x: 0.9, y: 0.45 },
      { slot: 'DM', position: 'DMF', x: 0.5, y: 0.38 },
      { slot: 'CM1', position: 'CMF', x: 0.35, y: 0.55 },
      { slot: 'CM2', position: 'CMF', x: 0.65, y: 0.55 },
      { slot: 'CF1', position: 'CF', x: 0.38, y: 0.85 },
      { slot: 'CF2', position: 'CF', x: 0.62, y: 0.85 },
    ],
  },
];
