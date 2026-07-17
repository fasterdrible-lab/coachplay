import React from 'react';
import type { CaptureSessionSnapshot } from '../../main/capture-session-state';

interface SessionControlsProps {
  snapshot: CaptureSessionSnapshot;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

const STATUS_LABELS: Record<CaptureSessionSnapshot['status'], string> = {
  starting: 'Iniciando',
  running: 'Capturando',
  paused: 'Pausado',
  stopped: 'Encerrado',
  failed: 'Falhou',
};

export function SessionControls({ snapshot, onPause, onResume, onStop }: SessionControlsProps) {
  const isRunning = snapshot.status === 'running';
  const isPaused = snapshot.status === 'paused';
  const isActive = isRunning || isPaused;

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <span>
        <span className={`status-dot status-${snapshot.status}`} />
        {STATUS_LABELS[snapshot.status]}
      </span>

      <span style={{ color: 'rgba(248,248,252,0.55)', fontSize: 13 }}>
        {snapshot.sourceName ?? '—'} · {snapshot.analysisFps} FPS de análise
      </span>

      {snapshot.errorMessage && <span style={{ color: '#e2718a' }}>{snapshot.errorMessage}</span>}

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        {isActive && isRunning && (
          <button className="btn btn-secondary" onClick={onPause}>
            Pausar
          </button>
        )}
        {isActive && isPaused && (
          <button className="btn btn-secondary" onClick={onResume}>
            Retomar
          </button>
        )}
        {isActive && (
          <button className="btn btn-danger" onClick={onStop}>
            Encerrar
          </button>
        )}
      </div>
    </div>
  );
}
