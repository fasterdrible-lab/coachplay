'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Gamepad2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { LEARNING_LEVELS, LEARNING_LEVEL_LABELS } from '../../../../lib/efootball';
import { Button } from '../../../../components/ui/button';
import { cn } from '../../../../lib/utils';

interface OnboardingResult {
  profile: { level: string };
  recommendedPath: { title: string; description: string | null } | null;
}

const LEVEL_HINTS: Record<string, string> = {
  BEGINNER: 'Nunca joguei ou ainda estou aprendendo os controles básicos.',
  CASUAL: 'Já jogo algumas partidas, mas sem muita técnica.',
  INTERMEDIATE: 'Entendo formações e estilos de jogo, quero evoluir jogadores.',
  ADVANCED: 'Monto builds pensando em função tática, quero afinar detalhes.',
  COMPETITIVE: 'Foco em elenco competitivo e uso de moedas com critério.',
};

export default function EfootballOnboardingPage() {
  const router = useRouter();
  const [level, setLevel] = useState('BEGINNER');
  const [goals, setGoals] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardingResult | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const goalsList = goals
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean);

      const data = await api.post<OnboardingResult>('/onboarding/efootball', {
        level,
        ...(goalsList.length > 0 && { goals: goalsList }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir o onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#6fcf97]/15">
            <CheckCircle2 className="h-7 w-7 text-[#6fcf97]" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-[#f8f8fc]">Tudo pronto!</h1>
          <p className="mb-6 text-sm text-[#f8f8fc]/55">
            Seu nível foi registrado como <strong className="text-[#f8f8fc]">{LEARNING_LEVEL_LABELS[result.profile.level]}</strong>.
          </p>

          {result.recommendedPath && (
            <div className="mb-6 rounded-lg border border-gold/20 bg-gold/5 p-4 text-left">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gold-bright">
                Trilha recomendada
              </p>
              <p className="text-sm font-medium text-[#f8f8fc]">{result.recommendedPath.title}</p>
              {result.recommendedPath.description && (
                <p className="mt-1 text-xs text-[#f8f8fc]/55">{result.recommendedPath.description}</p>
              )}
            </div>
          )}

          <Button className="w-full" onClick={() => router.push('/efootball')}>
            Ir para o eFootball
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15 text-gold-bright">
          <Gamepad2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#f8f8fc]">Bem-vindo ao módulo eFootball</h1>
          <p className="text-sm text-[#f8f8fc]/45">Conte seu nível pra recebermos recomendações melhores.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-6">
        <div>
          <p className="mb-2.5 text-sm font-medium text-white/80">Qual seu nível no eFootball?</p>
          <div className="space-y-2">
            {LEARNING_LEVELS.map((lvl) => (
              <label
                key={lvl}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                  level === lvl ? 'border-gold/50 bg-gold/5' : 'border-white/[0.08] hover:bg-white/[0.04]',
                )}
              >
                <input
                  type="radio"
                  name="level"
                  value={lvl}
                  checked={level === lvl}
                  onChange={() => setLevel(lvl)}
                  className="mt-1 accent-gold"
                />
                <span>
                  <span className="block text-sm font-medium text-[#f8f8fc]">{LEARNING_LEVEL_LABELS[lvl]}</span>
                  <span className="block text-xs text-[#f8f8fc]/45">{LEVEL_HINTS[lvl]}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="goals" className="mb-1.5 block text-sm font-medium text-white/80">
            O que você quer melhorar? (opcional)
          </label>
          <textarea
            id="goals"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="ex: finalização, montar elenco competitivo"
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[#f8f8fc] placeholder-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-[#f8f8fc]/45">Separe por vírgula.</p>
        </div>

        {error && <p className="text-sm text-[#e2718a]">{error}</p>}

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          {isSubmitting ? 'Enviando...' : 'Começar'}
        </Button>
      </form>
    </div>
  );
}
