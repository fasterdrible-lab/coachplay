'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Loader2, Lock } from 'lucide-react';
import { api } from '../../../../../lib/api';
import { LEARNING_LEVEL_LABELS } from '../../../../../lib/efootball';
import { Button } from '../../../../../components/ui/button';
import { cn } from '../../../../../lib/utils';

interface Lesson {
  id: string;
  title: string;
  content: string;
  order: number;
  unlocked: boolean;
  completed: boolean;
}

interface LearningModule {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface PathDetail {
  id: string;
  level: string;
  title: string;
  description: string | null;
  modules: LearningModule[];
}

interface PathProgress {
  completed: number;
  total: number;
  percent: number;
}

export default function AcademyPathPage() {
  const params = useParams<{ pathId: string }>();
  const router = useRouter();
  const [path, setPath] = useState<PathDetail | null>(null);
  const [progress, setProgress] = useState<PathProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [pathData, progressData] = await Promise.all([
        api.get<PathDetail>(`/learning/paths/${params.pathId}`),
        api.get<PathProgress>(`/learning/paths/${params.pathId}/progress`),
      ]);
      setPath(pathData);
      setProgress(progressData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar essa trilha.');
    } finally {
      setIsLoading(false);
    }
  }, [params.pathId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleComplete = async (lessonId: string) => {
    setCompletingId(lessonId);
    try {
      await api.post(`/learning/lessons/${lessonId}/complete`);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a aula.');
    } finally {
      setCompletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#f8f8fc]/35" />
      </div>
    );
  }

  if (error || !path) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl py-16 text-center">
          <AlertTriangle className="mb-3 h-8 w-8 text-[#e2718a]" />
          <p className="text-sm text-[#f8f8fc]/55">{error ?? 'Trilha não encontrada.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button
        onClick={() => router.push('/efootball/academy')}
        className="mb-4 flex items-center gap-1.5 text-sm text-[#f8f8fc]/55 hover:text-[#f8f8fc]"
      >
        <ArrowLeft className="h-4 w-4" />
        Todas as trilhas
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="mb-2 inline-block rounded-full bg-white/[0.08] px-2.5 py-0.5 text-xs font-medium text-[#f8f8fc]/70">
            {LEARNING_LEVEL_LABELS[path.level] ?? path.level}
          </span>
          <h1 className="text-2xl font-bold text-[#f8f8fc]">{path.title}</h1>
          {path.description && <p className="mt-1 text-sm text-[#f8f8fc]/45">{path.description}</p>}
        </div>
        {progress && (
          <div className="shrink-0 rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-4 text-right">
            <p className="text-2xl font-bold text-[#f8f8fc]">{progress.percent}%</p>
            <p className="text-xs text-[#f8f8fc]/45">{progress.completed}/{progress.total} aulas concluídas</p>
          </div>
        )}
      </div>

      <div className="space-y-5">
        {path.modules
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((learningModule) => (
            <div key={learningModule.id} className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
              <h2 className="mb-3 text-sm font-semibold text-[#f8f8fc]/70">{learningModule.title}</h2>
              <div className="space-y-2">
                {learningModule.lessons
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((lesson) => {
                    const isOpen = openLessonId === lesson.id;
                    return (
                      <div
                        key={lesson.id}
                        className={cn(
                          'rounded-lg border p-3',
                          lesson.completed
                            ? 'border-[#6fcf97]/20 bg-[#6fcf97]/5'
                            : lesson.unlocked
                              ? 'border-white/[0.08]'
                              : 'border-white/[0.05] opacity-50',
                        )}
                      >
                        <button
                          onClick={() => lesson.unlocked && setOpenLessonId(isOpen ? null : lesson.id)}
                          disabled={!lesson.unlocked}
                          className="flex w-full items-center gap-3 text-left disabled:cursor-not-allowed"
                        >
                          {lesson.completed ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#6fcf97]" />
                          ) : lesson.unlocked ? (
                            <ChevronRight className={cn('h-4 w-4 shrink-0 text-[#f8f8fc]/45 transition-transform', isOpen && 'rotate-90')} />
                          ) : (
                            <Lock className="h-4 w-4 shrink-0 text-[#f8f8fc]/30" />
                          )}
                          <span className="text-sm text-[#f8f8fc]/85">{lesson.title}</span>
                        </button>

                        {isOpen && lesson.unlocked && (
                          <div className="mt-3 border-t border-white/[0.06] pt-3">
                            <p className="mb-3 text-sm leading-relaxed text-[#f8f8fc]/70">{lesson.content}</p>
                            {!lesson.completed && (
                              <Button
                                variant="secondary"
                                isLoading={completingId === lesson.id}
                                onClick={() => handleComplete(lesson.id)}
                              >
                                Concluir aula
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
