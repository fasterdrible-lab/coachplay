import { computePathProgress, flattenLessons, isLessonUnlocked } from './learning-progress.util';

const modules = [
  { order: 0, lessons: [{ id: 'l1', order: 0 }, { id: 'l2', order: 1 }] },
  { order: 1, lessons: [{ id: 'l3', order: 0 }] },
];

describe('flattenLessons', () => {
  it('ordena por módulo e depois por aula, independente da ordem de entrada', () => {
    const shuffled = [modules[1], modules[0]];
    expect(flattenLessons(shuffled).map((l) => l.id)).toEqual(['l1', 'l2', 'l3']);
  });
});

describe('isLessonUnlocked', () => {
  const flat = flattenLessons(modules);

  it('a primeira aula da trilha está sempre desbloqueada', () => {
    expect(isLessonUnlocked(flat, 'l1', new Set())).toBe(true);
  });

  it('a segunda aula fica bloqueada até a primeira ser concluída', () => {
    expect(isLessonUnlocked(flat, 'l2', new Set())).toBe(false);
  });

  it('desbloqueia a aula seguinte quando a anterior é concluída', () => {
    expect(isLessonUnlocked(flat, 'l2', new Set(['l1']))).toBe(true);
  });

  it('não desbloqueia pulando etapas (l3 sem l2 concluída)', () => {
    expect(isLessonUnlocked(flat, 'l3', new Set(['l1']))).toBe(false);
  });

  it('retorna false para uma aula que não pertence à trilha', () => {
    expect(isLessonUnlocked(flat, 'inexistente', new Set())).toBe(false);
  });
});

describe('computePathProgress', () => {
  const flat = flattenLessons(modules);

  it('calcula 0% sem nenhuma aula concluída', () => {
    expect(computePathProgress(flat, new Set())).toEqual({ completed: 0, total: 3, percent: 0 });
  });

  it('calcula o percentual conforme aulas concluídas', () => {
    expect(computePathProgress(flat, new Set(['l1', 'l2']))).toEqual({ completed: 2, total: 3, percent: 67 });
  });

  it('calcula 100% com todas as aulas concluídas', () => {
    expect(computePathProgress(flat, new Set(['l1', 'l2', 'l3']))).toEqual({ completed: 3, total: 3, percent: 100 });
  });
});
