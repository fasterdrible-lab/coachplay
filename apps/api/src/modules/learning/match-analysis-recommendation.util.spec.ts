import { mapWorstCategoryToModuleTitle } from './match-analysis-recommendation.util';

describe('mapWorstCategoryToModuleTitle (Tarefa 15)', () => {
  it('mapeia cada uma das 4 categorias agregadas do Match Analysis pro módulo correspondente', () => {
    expect(mapWorstCategoryToModuleTitle('attack')).toBe('Finalização');
    expect(mapWorstCategoryToModuleTitle('defense')).toBe('Defesa');
    expect(mapWorstCategoryToModuleTitle('passing')).toBe('Passe');
    expect(mapWorstCategoryToModuleTitle('decision')).toBe('Movimentação');
  });

  it('categoria desconhecida retorna null em vez de inventar um módulo', () => {
    expect(mapWorstCategoryToModuleTitle('inexistente')).toBeNull();
  });
});
