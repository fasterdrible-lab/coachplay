import { findNextUnlockedLesson } from './next-lesson.util';

describe('findNextUnlockedLesson', () => {
  it('retorna a primeira aula desbloqueada e não concluída, na ordem dos módulos', () => {
    const result = findNextUnlockedLesson([
      { title: 'Fundamentos', lessons: [{ id: 'l1', title: 'Intro', unlocked: true, completed: true }] },
      { title: 'Passe', lessons: [{ id: 'l2', title: 'Passe certo', unlocked: true, completed: false }] },
    ]);

    expect(result).toEqual({ moduleTitle: 'Passe', lessonTitle: 'Passe certo', lessonId: 'l2' });
  });

  it('pula aulas já concluídas ou ainda bloqueadas', () => {
    const result = findNextUnlockedLesson([
      {
        title: 'Fundamentos',
        lessons: [
          { id: 'l1', title: 'Intro', unlocked: true, completed: true },
          { id: 'l2', title: 'Avançado', unlocked: false, completed: false },
        ],
      },
    ]);

    expect(result).toBeNull();
  });

  it('todas as aulas concluídas: retorna null', () => {
    const result = findNextUnlockedLesson([
      { title: 'Fundamentos', lessons: [{ id: 'l1', title: 'Intro', unlocked: true, completed: true }] },
    ]);

    expect(result).toBeNull();
  });
});
