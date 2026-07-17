'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../providers/auth-provider';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserDetail {
  id: string;
  name: string;
  email: string;
  preferences: {
    feedbackLevel: string;
    voiceEnabled: boolean;
    language: string;
    favoriteMode: string | null;
  } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FEEDBACK_LEVELS = [
  { value: 'simple', label: 'Simples — só o essencial' },
  { value: 'normal', label: 'Normal — equilibrado' },
  { value: 'detailed', label: 'Detalhado — análise completa' },
];

const LANGUAGES = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'es-ES', label: 'Español' },
];

const GAME_MODES = [
  'Ultimate Team',
  'Rivals',
  'Champions',
  'Squad Battles',
  'Pro Clubs',
  'Volta Football',
  'Amistoso',
];

const DEFAULT_PREFERENCES = {
  feedbackLevel: 'normal',
  voiceEnabled: false,
  language: 'pt-BR',
  favoriteMode: '',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState('');
  const [feedbackLevel, setFeedbackLevel] = useState(DEFAULT_PREFERENCES.feedbackLevel);
  const [voiceEnabled, setVoiceEnabled] = useState(DEFAULT_PREFERENCES.voiceEnabled);
  const [language, setLanguage] = useState(DEFAULT_PREFERENCES.language);
  const [favoriteMode, setFavoriteMode] = useState(DEFAULT_PREFERENCES.favoriteMode);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    api
      .get<UserDetail>(`/users/${user.id}`)
      .then((res) => {
        if (cancelled) return;
        setName(res.name);
        setFeedbackLevel(res.preferences?.feedbackLevel ?? DEFAULT_PREFERENCES.feedbackLevel);
        setVoiceEnabled(res.preferences?.voiceEnabled ?? DEFAULT_PREFERENCES.voiceEnabled);
        setLanguage(res.preferences?.language ?? DEFAULT_PREFERENCES.language);
        setFavoriteMode(res.preferences?.favoriteMode ?? '');
      })
      .catch(() => { if (!cancelled) setLoadError('Não foi possível carregar suas preferências.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setSaveError('');
    setSaved(false);

    try {
      await api.put(`/users/${user.id}`, {
        name,
        feedbackLevel,
        voiceEnabled,
        language,
        favoriteMode: favoriteMode || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/35" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-[#f8f8fc]">Configurações</h1>
        <p className="mt-1 text-sm text-white/55">Preferências de conta e de análise</p>
      </div>

      {loadError && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-[#e2718a]/30 bg-[#e2718a]/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#e2718a]" />
          <p className="text-sm text-[#e2718a]">{loadError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Conta */}
        <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
          <h2 className="mb-4 text-sm font-semibold text-white/80">Conta</h2>
          <Input
            id="name"
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
          <p className="mt-2 text-xs text-white/45">{user?.email}</p>
        </div>

        {/* Preferências de análise */}
        <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white/80">Preferências de análise</h2>

          <div className="space-y-1.5">
            <label htmlFor="feedbackLevel" className="block text-sm font-medium text-white/80">
              Nível de feedback
            </label>
            <div className="relative">
              <select
                id="feedbackLevel"
                value={feedbackLevel}
                onChange={(e) => setFeedbackLevel(e.target.value)}
                className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] py-2.5 pl-3 pr-9 text-sm text-[#f8f8fc] focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50"
              >
                {FEEDBACK_LEVELS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="favoriteMode" className="block text-sm font-medium text-white/80">
              Modo de jogo favorito
            </label>
            <div className="relative">
              <select
                id="favoriteMode"
                value={favoriteMode}
                onChange={(e) => setFavoriteMode(e.target.value)}
                className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] py-2.5 pl-3 pr-9 text-sm text-[#f8f8fc] focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50"
              >
                <option value="">Sem preferência</option>
                {GAME_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
            </div>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[#f8f8fc]">Feedback por voz</p>
              <p className="text-xs text-white/45">Narração falada dos pontos-chave da análise</p>
            </div>
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={(e) => setVoiceEnabled(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-gold"
            />
          </label>
        </div>

        {/* Idioma */}
        <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-5">
          <h2 className="mb-4 text-sm font-semibold text-white/80">Idioma</h2>
          <div className="relative">
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] py-2.5 pl-3 pr-9 text-sm text-[#f8f8fc] focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50"
            >
              {LANGUAGES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
          </div>
        </div>

        {saveError && (
          <div className="flex items-center gap-2 rounded-lg border border-[#e2718a]/30 bg-[#e2718a]/10 px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-[#e2718a]" />
            <p className="text-sm text-[#e2718a]">{saveError}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" isLoading={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-[#6fcf97]">
              <CheckCircle2 className="h-4 w-4" />
              Salvo com sucesso
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
