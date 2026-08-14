import {
  STRATEGIC_PRINCIPLE_CATALOG,
  StrategicPrincipleId,
  getAllStrategicPrinciples,
  getStrategicPrinciple,
} from './strategic-principle.type';

describe('strategic-principle catalog', () => {
  it('toda entrada do catálogo tem id, nome, origem no xadrez e tradução para futebol', () => {
    for (const principle of getAllStrategicPrinciples()) {
      expect(principle.id).toBeTruthy();
      expect(principle.name.length).toBeGreaterThan(0);
      expect(principle.chessOrigin.length).toBeGreaterThan(0);
      expect(principle.footballTranslation.length).toBeGreaterThan(0);
    }
  });

  it('a chave do catálogo é sempre igual ao id da entrada (sem divergência)', () => {
    for (const [key, principle] of Object.entries(STRATEGIC_PRINCIPLE_CATALOG)) {
      expect(principle.id).toBe(key as StrategicPrincipleId);
    }
  });

  it('getStrategicPrinciple retorna a entrada correspondente do catálogo', () => {
    expect(getStrategicPrinciple('OVERLOAD')).toBe(STRATEGIC_PRINCIPLE_CATALOG.OVERLOAD);
  });

  it('catálogo tem exatamente os 8 princípios do plano (Fase 4, Tarefas 18-22)', () => {
    expect(getAllStrategicPrinciples()).toHaveLength(8);
  });
});
