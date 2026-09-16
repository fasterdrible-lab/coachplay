'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, GraduationCap, Loader2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { getEfootballGameId, LEARNING_LEVEL_LABELS } from '../../../../lib/efootball';
import { cn } from '../../../../lib/utils';

interface LearningPath {
  id: string;
  level: string;
  title: string;
  description: string | null;
  order: number;
}

interface LearningProfile {
  level: string;
}

export default function AcademyPage() {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const gameId = await getEfootballGameId();
        const [pathsData, profileData] = await Promise.all([
          api.get<LearningPath[]>(`/learning/paths?gameId=${gameId}`),
          api.get<LearningProfile>('/learning/profile'),
        ]);
        if (cancelled) return;
        setPaths(pathsData.sort((a, b) => a.order - b.order));
        setProfile(profileData);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível carregar as trilhas.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#f8f8fc]/35" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold text-[#f8f8fc]">Academia CoachPlay</h1>
      <p className="mb-6 text-sm text-[#f8f8fc]/45">Trilhas de aprendizado por nível, do iniciante ao competitivo</p>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-[#e2718a]/20 bg-[#e2718a]/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#e2718a]" />
          <p className="text-sm text-[#e2718a]">{error}</p>
        </div>
      )}

      {!error && paths.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl py-16 text-center">
          <GraduationCap className="mb-3 h-8 w-8 text-[#f8f8fc]/25" />
          <p className="text-sm text-[#f8f8fc]/55">Nenhuma trilha cadastrada ainda.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paths.map((path) => {
          const isCurrentLevel = profile?.level === path.level;
          return (
            <Link
              key={path.id}
              href={`/efootball/academy/${path.id}`}
              className={cn(
                'block rounded-xl border p-5 transition-colors',
                isCurrentLevel ? 'border-gold/40 bg-gold/5' : 'border-white/[0.08] bg-ink2/60 backdrop-blur-xl hover:bg-white/[0.04]',
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-xs font-medium text-[#f8f8fc]/70">
                  {LEARNING_LEVEL_LABELS[path.level] ?? path.level}
                </span>
                {isCurrentLevel && (
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold-bright">Seu nível</span>
                )}
              </div>
              <h2 className="mb-1 text-base font-semibold text-[#f8f8fc]">{path.title}</h2>
              {path.description && <p className="text-sm text-[#f8f8fc]/55">{path.description}</p>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
