import React, { useEffect, useRef } from 'react';
import type { CaptureSourceInfo } from '../../main/local-capture-controller';

interface CapturePreviewProps {
  source: CaptureSourceInfo;
  analysisFps: number;
  isPaused: boolean;
  onSourceEnded: () => void;
}

const ANALYSIS_MAX_WIDTH = 1280;
const ANALYSIS_MAX_HEIGHT = 720;

export function CapturePreview({ source, analysisFps, isPaused, onSourceEnded }: CapturePreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Abre o MediaStream da fonte escolhida — é aqui, e só aqui, que pixels de
  // tela de verdade chegam ao processo. Usa a API não-padrão do Chromium
  // (chromeMediaSource) que o Electron expõe para captura de desktop.
  useEffect(() => {
    let cancelled = false;

    async function openStream() {
      const constraints = {
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            maxWidth: ANALYSIS_MAX_WIDTH,
            maxHeight: ANALYSIS_MAX_HEIGHT,
          },
        },
      } as unknown as MediaStreamConstraints;

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      stream.getVideoTracks()[0]?.addEventListener('ended', onSourceEnded);
    }

    openStream().catch(() => onSourceEnded());

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.id]);

  // Amostragem de frames na frequência de análise configurada (1–5 FPS no MVP)
  useEffect(() => {
    if (isPaused) return;

    const intervalMs = 1000 / Math.max(analysisFps, 1);
    const timer = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_CURRENT_DATA) return;

      canvas.width = Math.min(video.videoWidth, ANALYSIS_MAX_WIDTH) || ANALYSIS_MAX_WIDTH;
      canvas.height = Math.min(video.videoHeight, ANALYSIS_MAX_HEIGHT) || ANALYSIS_MAX_HEIGHT;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const buffer = await blob.arrayBuffer();
        await window.coachPlay.capture.submitFrame(buffer, Date.now());
      }, 'image/png');
    }, intervalMs);

    return () => clearInterval(timer);
  }, [analysisFps, isPaused]);

  return (
    <div className="card">
      <video ref={videoRef} autoPlay muted style={{ width: '100%', borderRadius: 8, background: '#000' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
