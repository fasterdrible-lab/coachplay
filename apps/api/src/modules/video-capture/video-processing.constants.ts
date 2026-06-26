export const VIDEO_PROCESSING_QUEUE = 'video-processing';
export const VIDEO_PROCESSING_JOB = 'process-video';

export interface VideoProcessingJobData {
  matchId: string;
  /** Caminho absoluto do arquivo de vídeo no disco */
  videoPath: string;
}
