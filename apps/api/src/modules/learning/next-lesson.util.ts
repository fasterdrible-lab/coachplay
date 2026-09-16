export interface NextLessonRef {
  moduleTitle: string;
  lessonTitle: string;
  lessonId: string;
}

interface LessonWithProgress {
  id: string;
  title: string;
  unlocked: boolean;
  completed: boolean;
}

interface ModuleWithLessonProgress {
  title: string;
  lessons: LessonWithProgress[];
}

/**
 * Primeira aula desbloqueada e ainda não concluída, na ordem canônica já resolvida por
 * `LearningService.getPath` (Tarefa 12) — reusada tanto pelo Ask Coach (Tarefa 14, intent
 * LEARNING_RECOMMENDATION) quanto pela Recomendação adaptativa (Tarefa 17).
 */
export function findNextUnlockedLesson(modules: ModuleWithLessonProgress[]): NextLessonRef | null {
  for (const learningModule of modules) {
    for (const lesson of learningModule.lessons) {
      if (lesson.unlocked && !lesson.completed) {
        return { moduleTitle: learningModule.title, lessonTitle: lesson.title, lessonId: lesson.id };
      }
    }
  }
  return null;
}
