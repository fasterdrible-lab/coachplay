'use client';

import { type DragEvent, type FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  FileVideo,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { getToken } from '../../../../lib/auth';
import { Button } from '../../../../components/ui/button';
import { cn } from '../../../../lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const GAME_MODES = [
  'Ultimate Team',
  'Rivals',
  'Champions',
  'Squad Battles',
  'Pro Clubs',
  'Volta Football',
  'Amistoso',
];

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const MAX_SIZE = 1024 * 1024 * 1024; // 1 GB
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function uploadVideoXHR(
  matchId: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('video', file);

    const token = getToken();
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        let msg = `Erro ${xhr.status}`;
        try {
          msg = (JSON.parse(xhr.responseText) as { message?: string }).message ?? msg;
        } catch {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Falha na conexão durante o upload.'));
    xhr.open('POST', `${BASE_URL}/matches/${matchId}/video`);
    xhr.withCredentials = true;
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'creating' | 'uploading' | 'done';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewMatchPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [gameMode, setGameMode] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [scoreUser, setScoreUser] = useState('');
  const [scoreOpponent, setScoreOpponent] = useState('');

  // Video state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState('');

  // Submit state
  const [phase, setPhase] = useState<Phase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  // ─── File handling ──────────────────────────────────────────────────────────

  function validateAndSet(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError('Formato inválido. Use MP4, MOV ou AVI.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setFileError('Arquivo muito grande. Máximo: 1GB.');
      return;
    }
    setFileError('');
    setVideoFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSet(file);
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!videoFile) {
      setFileError('Selecione um vídeo para continuar.');
      return;
    }

    setError('');

    try {
      // Phase 1 — create match metadata
      setPhase('creating');
      const match = await api.post<{ id: string }>('/matches', {
        title: title.trim() || undefined,
        gameMode: gameMode || undefined,
        matchDate: matchDate || undefined,
        scoreUser: scoreUser !== '' ? parseInt(scoreUser, 10) : undefined,
        scoreOpponent: scoreOpponent !== '' ? parseInt(scoreOpponent, 10) : undefined,
      });

      // Phase 2 — upload video
      setPhase('uploading');
      setUploadProgress(0);
      await uploadVideoXHR(match.id, videoFile, setUploadProgress);

      // Done
      setPhase('done');
      setTimeout(() => router.push('/matches'), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro. Tente novamente.');
      setPhase('idle');
    }
  }

  const isSubmitting = phase === 'creating' || phase === 'uploading';

  // ─── Render ─────────────────────────────────────────────────────────────────

  // Done state
  if (phase === 'done') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#6fcf97]/15">
            <CheckCircle2 className="h-8 w-8 text-[#6fcf97]" />
          </div>
          <p className="text-xl font-semibold text-[#f8f8fc]">Partida criada!</p>
          <p className="text-sm text-[#f8f8fc]/45">Redirecionando para suas partidas...</p>
        </div>
      </div>
    );
  }

  // Uploading state
  if (phase === 'uploading') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-full max-w-sm px-4">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/15">
              <UploadCloud className="h-8 w-8 text-gold-bright" />
            </div>
            <div className="w-full">
              <p className="mb-4 text-base font-semibold text-[#f8f8fc]">Enviando vídeo</p>
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gold transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-[#f8f8fc]/45">
                <span>{videoFile?.name}</span>
                <span>{uploadProgress}%</span>
              </div>
            </div>
            <p className="text-xs text-[#f8f8fc]/35">Não feche ou atualize esta página</p>
          </div>
        </div>
      </div>
    );
  }

  // Form state (idle | creating)
  return (
    <div className="mx-auto max-w-2xl p-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link href="/matches" className="text-[#f8f8fc]/55 hover:text-[#f8f8fc] transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#f8f8fc]">Nova Partida</h1>
          <p className="mt-0.5 text-sm text-[#f8f8fc]/45">Preencha os dados e envie o vídeo para análise</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-[#e2718a]/30 bg-[#e2718a]/10 px-4 py-3">
            <p className="text-sm text-[#e2718a]">{error}</p>
          </div>
        )}

        {/* Section: Metadados */}
        <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-6">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-[#f8f8fc]/55">
            Dados da partida
          </h2>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-[#f8f8fc]/80">
                Título <span className="text-[#f8f8fc]/35">(opcional)</span>
              </label>
              <input
                id="title"
                type="text"
                maxLength={100}
                placeholder="Ex: Rivals Div 2 — quarta-feira"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-[#f8f8fc] placeholder-white/30 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50"
              />
            </div>

            {/* Game mode */}
            <div>
              <label htmlFor="gameMode" className="mb-1.5 block text-sm font-medium text-[#f8f8fc]/80">
                Modo de jogo <span className="text-[#f8f8fc]/35">(opcional)</span>
              </label>
              <select
                id="gameMode"
                value={gameMode}
                onChange={(e) => setGameMode(e.target.value)}
                className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-[#f8f8fc] focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50"
              >
                <option value="">Selecionar modo</option>
                {GAME_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label htmlFor="matchDate" className="mb-1.5 block text-sm font-medium text-[#f8f8fc]/80">
                Data da partida <span className="text-[#f8f8fc]/35">(opcional)</span>
              </label>
              <input
                id="matchDate"
                type="date"
                value={matchDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setMatchDate(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-[#f8f8fc] focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50 [color-scheme:dark]"
              />
            </div>

            {/* Score */}
            <div>
              <p className="mb-1.5 text-sm font-medium text-[#f8f8fc]/80">
                Placar <span className="text-[#f8f8fc]/35">(opcional)</span>
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label htmlFor="scoreUser" className="mb-1 block text-xs text-[#f8f8fc]/45">
                    Meus gols
                  </label>
                  <input
                    id="scoreUser"
                    type="number"
                    min={0}
                    max={99}
                    placeholder="0"
                    value={scoreUser}
                    onChange={(e) => setScoreUser(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-center text-sm text-[#f8f8fc] placeholder-gray-600 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50"
                  />
                </div>
                <span className="mt-5 text-lg font-bold text-[#f8f8fc]/35">×</span>
                <div className="flex-1">
                  <label htmlFor="scoreOpponent" className="mb-1 block text-xs text-[#f8f8fc]/45">
                    Gols do adversário
                  </label>
                  <input
                    id="scoreOpponent"
                    type="number"
                    min={0}
                    max={99}
                    placeholder="0"
                    value={scoreOpponent}
                    onChange={(e) => setScoreOpponent(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-center text-sm text-[#f8f8fc] placeholder-gray-600 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Vídeo */}
        <div className="rounded-xl border border-white/[0.08] bg-ink2/60 backdrop-blur-xl p-6">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-[#f8f8fc]/55">
            Vídeo da partida
          </h2>

          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,.mp4,.mov,.avi"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) validateAndSet(file);
              e.target.value = '';
            }}
          />

          {videoFile ? (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
              <FileVideo className="h-8 w-8 shrink-0 text-gold-bright" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#f8f8fc]">{videoFile.name}</p>
                <p className="text-xs text-[#f8f8fc]/45">{formatBytes(videoFile.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => setVideoFile(null)}
                aria-label="Remover vídeo"
                className="rounded p-1 text-[#f8f8fc]/55 transition-colors hover:bg-white/[0.08] hover:text-[#f8f8fc]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors select-none',
                isDragging
                  ? 'border-gold bg-gold/10'
                  : 'border-white/10 hover:border-white/20 hover:bg-white/[0.03]',
              )}
            >
              <UploadCloud
                className={cn(
                  'mb-3 h-10 w-10 transition-colors',
                  isDragging ? 'text-gold-bright' : 'text-[#f8f8fc]/45',
                )}
              />
              <p className="text-sm font-medium text-[#f8f8fc]/80">Arraste o vídeo aqui</p>
              <p className="mt-1 text-xs text-[#f8f8fc]/45">ou clique para selecionar</p>
              <p className="mt-3 text-xs text-[#f8f8fc]/35">MP4, MOV ou AVI · máx. 1GB</p>
            </div>
          )}

          {fileError && (
            <p className="mt-2 text-xs text-[#e2718a]">{fileError}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <Link href="/matches">
            <Button type="button" variant="ghost" disabled={isSubmitting}>
              Cancelar
            </Button>
          </Link>
          <Button type="submit" isLoading={phase === 'creating'} disabled={isSubmitting}>
            {phase === 'creating' ? 'Criando partida...' : 'Criar partida'}
          </Button>
        </div>
      </form>
    </div>
  );
}
