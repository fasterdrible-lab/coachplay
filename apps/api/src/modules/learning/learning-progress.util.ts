export interface FlatLesson {
  id: string;
  moduleOrder: number;
  lessonOrder: number;
}

export interface ModuleWithLessons {
  order: number;
  lessons: Array<{ id: string; order: number }>;
}

/** Ordem canônica de uma trilha: módulos por `order`, aulas por `order` dentro do módulo. */
export function flattenLessons(modules: ModuleWithLessons[]): FlatLesson[] {
  return [...modules]
    .sort((a, b) => a.order - b.order)
    .flatMap((m) =>
      [...m.lessons]
        .sort((a, b) => a.order - b.order)
        .map((l) => ({ id: l.id, moduleOrder: m.order, lessonOrder: l.order })),
    );
}

/** A primeira aula da trilha está sempre desbloqueada; as demais exigem que a aula anterior
 * (na ordem canônica) já esteja concluída pelo usuário. */
export function isLessonUnlocked(
  flatLessons: FlatLesson[],
  lessonId: string,
  completedLessonIds: ReadonlySet<string>,
): boolean {
  const index = flatLessons.findIndex((l) => l.id === lessonId);
  if (index === -1) return false;
  if (index === 0) return true;
  return completedLessonIds.has(flatLessons[index - 1].id);
}

export interface PathProgress {
  completed: number;
  total: number;
  percent: number;
}

export function computePathProgress(
  flatLessons: FlatLesson[],
  completedLessonIds: ReadonlySet<string>,
): PathProgress {
  const total = flatLessons.length;
  const completed = flatLessons.filter((l) => completedLessonIds.has(l.id)).length;
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}
