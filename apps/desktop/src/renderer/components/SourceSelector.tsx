import React, { useEffect, useState } from 'react';
import type { CaptureSourceInfo } from '../../main/local-capture-controller';

interface SourceSelectorProps {
  onSelect: (source: CaptureSourceInfo) => void;
}

export function SourceSelector({ onSelect }: SourceSelectorProps) {
  const [sources, setSources] = useState<CaptureSourceInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    setIsLoading(true);
    setError('');
    try {
      const list = await window.coachPlay.capture.listSources();
      setSources(list);
    } catch {
      setError('Não foi possível listar as janelas e monitores disponíveis.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Escolha o que capturar</h2>
        <button className="btn btn-secondary" onClick={refresh} disabled={isLoading}>
          Atualizar lista
        </button>
      </div>
      <p style={{ color: 'rgba(248,248,252,0.55)' }}>
        Selecione a janela do Xbox Remote Play (recomendado) ou o monitor inteiro.
      </p>

      {error && <p style={{ color: '#e2718a' }}>{error}</p>}
      {isLoading && <p>Carregando...</p>}

      {!isLoading && (
        <div className="source-list">
          {sources.map((source) => (
            <div
              key={source.id}
              className={`source-item${selectedId === source.id ? ' selected' : ''}`}
              onClick={() => setSelectedId(source.id)}
            >
              {source.thumbnailDataUrl && <img src={source.thumbnailDataUrl} alt={source.name} />}
              <p style={{ fontSize: 13, margin: '6px 0 0' }}>{source.name}</p>
              <p style={{ fontSize: 11, margin: 0, color: 'rgba(248,248,252,0.45)' }}>
                {source.type === 'monitor' ? 'Monitor' : 'Janela'}
              </p>
            </div>
          ))}
        </div>
      )}

      <button
        className="btn btn-primary"
        style={{ marginTop: 16 }}
        disabled={!selectedId}
        onClick={() => {
          const source = sources.find((s) => s.id === selectedId);
          if (source) onSelect(source);
        }}
      >
        Continuar com esta fonte
      </button>
    </div>
  );
}
