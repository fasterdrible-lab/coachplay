import React, { useEffect, useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { ConsentScreen } from './components/ConsentScreen';
import { MatchSelector } from './components/MatchSelector';
import { SourceSelector } from './components/SourceSelector';
import { CapturePreview } from './components/CapturePreview';
import { SessionControls } from './components/SessionControls';
import type { CaptureSourceInfo } from '../main/local-capture-controller';
import type { CaptureSessionSnapshot } from '../main/capture-session-state';
import type { AuthenticatedUser } from '../main/backend-client';

type Step = 'login' | 'consent' | 'select-match' | 'select-source' | 'capturing';

export function App() {
  const [step, setStep] = useState<Step>('login');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<CaptureSourceInfo | null>(null);
  const [snapshot, setSnapshot] = useState<CaptureSessionSnapshot | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    return window.coachPlay.capture.onSourceLost(() => {
      setError('A janela ou monitor selecionado não está mais disponível. A sessão foi encerrada.');
      setStep('select-source');
      setSelectedSource(null);
      setSnapshot(null);
    });
  }, []);

  async function handleSourceSelected(source: CaptureSourceInfo) {
    setError('');
    try {
      const result = await window.coachPlay.capture.start({
        matchId: matchId ?? undefined,
        sourceType: source.type,
        sourceName: source.name,
        captureFps: 2,
        analysisFps: 1,
      });
      setSelectedSource(source);
      setSnapshot(result);
      setStep('capturing');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível iniciar a captura. Verifique sua conexão e tente novamente.',
      );
    }
  }

  async function handlePause() {
    setSnapshot(await window.coachPlay.capture.pause());
  }

  async function handleResume() {
    setSnapshot(await window.coachPlay.capture.resume());
  }

  async function handleStop() {
    setSnapshot(await window.coachPlay.capture.stop());
    setStep('select-match');
    setSelectedSource(null);
    setMatchId(null);
  }

  return (
    <div className="app">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ margin: 0 }}>Coach Play — Captura via Remote Play</h1>
        {user && (
          <span style={{ color: 'rgba(248,248,252,0.55)', fontSize: 13 }}>
            {user.name} ({user.email})
          </span>
        )}
      </div>

      {error && (
        <div className="card" style={{ borderColor: '#e2718a' }}>
          <p style={{ color: '#e2718a', margin: 0 }}>{error}</p>
        </div>
      )}

      {step === 'login' && (
        <LoginScreen
          onSuccess={(loggedUser) => {
            setUser(loggedUser);
            setStep('consent');
          }}
        />
      )}

      {step === 'consent' && <ConsentScreen onAccept={() => setStep('select-match')} />}

      {step === 'select-match' && (
        <MatchSelector
          onSelect={(id) => {
            setMatchId(id);
            setStep('select-source');
          }}
        />
      )}

      {step === 'select-source' && <SourceSelector onSelect={handleSourceSelected} />}

      {step === 'capturing' && selectedSource && snapshot && (
        <>
          <SessionControls
            snapshot={snapshot}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
          />
          <CapturePreview
            source={selectedSource}
            analysisFps={snapshot.analysisFps}
            isPaused={snapshot.status === 'paused'}
            sessionStartedAt={snapshot.startedAt ?? Date.now()}
            onSourceEnded={() => {
              setError('O sinal da fonte selecionada foi perdido.');
              handleStop();
            }}
          />
        </>
      )}
    </div>
  );
}
