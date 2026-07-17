import React, { useEffect, useState } from 'react';
import { ConsentScreen } from './components/ConsentScreen';
import { SourceSelector } from './components/SourceSelector';
import { CapturePreview } from './components/CapturePreview';
import { SessionControls } from './components/SessionControls';
import type { CaptureSourceInfo } from '../main/local-capture-controller';
import type { CaptureSessionSnapshot } from '../main/capture-session-state';

type Step = 'consent' | 'select-source' | 'capturing';

export function App() {
  const [step, setStep] = useState<Step>('consent');
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
        sourceType: source.type,
        sourceName: source.name,
        captureFps: 2,
        analysisFps: 1,
      });
      setSelectedSource(source);
      setSnapshot(result);
      setStep('capturing');
    } catch {
      setError('Não foi possível iniciar a captura. Verifique sua conexão e tente novamente.');
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
    setStep('select-source');
    setSelectedSource(null);
  }

  return (
    <div className="app">
      <h1 style={{ margin: 0 }}>Coach Play — Captura via Remote Play</h1>

      {error && (
        <div className="card" style={{ borderColor: '#e2718a' }}>
          <p style={{ color: '#e2718a', margin: 0 }}>{error}</p>
        </div>
      )}

      {step === 'consent' && <ConsentScreen onAccept={() => setStep('select-source')} />}

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
