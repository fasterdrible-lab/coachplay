export const CAPTURE_FRAME_ANALYSIS_QUEUE = 'capture-frame-analysis';
export const CAPTURE_FRAME_ANALYSIS_JOB = 'analyze-frame';

export interface CaptureFrameAnalysisJobData {
  frameSampleId: string;
  captureSessionId: string;
  /** Caminho absoluto no disco (Multer file.path) — não o framePath público salvo no banco */
  absoluteFramePath: string;
  timestampMs: number;
}

// Confiança mínima para persistir um GameEvent (heurística de motion, ver event-detector.service.ts).
export const EVENT_MIN_CONFIDENCE = 0.55;
// Confiança mínima, mais alta, para acionar a IA e gerar um CoachFeedback — chamadas de IA custam
// dinheiro, então só disparam para os eventos mais prováveis.
export const FEEDBACK_MIN_CONFIDENCE = 0.7;
