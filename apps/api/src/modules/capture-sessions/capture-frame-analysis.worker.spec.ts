import { CaptureFrameAnalysisWorker } from './capture-frame-analysis.worker';
import { PrismaService } from '../../shared/database/prisma.service';
import { GameStateDetectorService } from './game-state-detector.service';
import { EventDetectorService } from './event-detector.service';
import { AiCoachService } from '../ai-coach/ai-coach.service';
import { CaptureFrameAnalysisJobData } from './capture-frame-analysis.constants';

function buildJob(data: Partial<CaptureFrameAnalysisJobData> = {}) {
  return {
    id: 'job-1',
    data: {
      frameSampleId: 'frame-1',
      captureSessionId: 'sess-1',
      absoluteFramePath: 'C:\\uploads\\frames\\frame-1.png',
      timestampMs: 5000,
      ...data,
    },
  } as any;
}

describe('CaptureFrameAnalysisWorker', () => {
  let prisma: {
    captureSession: { findUnique: jest.Mock };
    frameSample: { findFirst: jest.Mock; update: jest.Mock };
    gameEvent: { create: jest.Mock };
  };
  let gameStateDetector: Partial<GameStateDetectorService>;
  let eventDetector: Partial<EventDetectorService>;
  let aiCoachService: Partial<AiCoachService>;
  let worker: CaptureFrameAnalysisWorker;

  const sessionWithMatch = { id: 'sess-1', matchId: 'match-1', user: { preferences: { feedbackLevel: 'normal' } } };
  const sessionWithoutMatch = { id: 'sess-1', matchId: null, user: { preferences: null } };

  beforeEach(() => {
    prisma = {
      captureSession: { findUnique: jest.fn() },
      frameSample: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
      gameEvent: { create: jest.fn().mockResolvedValue({ id: 'event-1', matchId: 'match-1' }) },
    };
    gameStateDetector = {
      detect: jest.fn().mockResolvedValue({ gameState: 'match_running', confidence: 0.8, motionScore: 0.6 }),
    };
    eventDetector = {
      detectCandidate: jest.fn().mockResolvedValue(null),
    };
    aiCoachService = { generateEventFeedback: jest.fn().mockResolvedValue(null) };

    worker = new CaptureFrameAnalysisWorker(
      prisma as unknown as PrismaService,
      gameStateDetector as GameStateDetectorService,
      eventDetector as EventDetectorService,
      aiCoachService as AiCoachService,
    );
  });

  it('marca o frame como "skipped" e não faz mais nada quando não há frame anterior para diff', async () => {
    prisma.captureSession.findUnique.mockResolvedValue(sessionWithMatch);
    (gameStateDetector.detect as jest.Mock).mockResolvedValue({ gameState: null, confidence: null, motionScore: null });

    await worker.process(buildJob());

    expect(prisma.frameSample.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { analysisStatus: 'skipped' } }),
    );
    expect(eventDetector.detectCandidate).not.toHaveBeenCalled();
  });

  it('caminho feliz: classifica o frame, cria GameEvent e gera feedback quando a confiança é alta', async () => {
    prisma.captureSession.findUnique.mockResolvedValue(sessionWithMatch);
    (eventDetector.detectCandidate as jest.Mock).mockResolvedValue({
      confidence: 0.75,
      motionSpike: 0.4,
      windowSize: 5,
      description: 'pico de movimento',
    });

    await worker.process(buildJob());

    expect(prisma.frameSample.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gameState: 'match_running', analysisStatus: 'analyzed' }),
      }),
    );
    expect(prisma.gameEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ matchId: 'match-1', captureSessionId: 'sess-1' }) }),
    );
    expect(aiCoachService.generateEventFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'event-1' }),
      'sess-1',
      'normal',
    );
  });

  it('sessão sem matchId: classifica o frame mas não cria GameEvent nem chama feedback', async () => {
    prisma.captureSession.findUnique.mockResolvedValue(sessionWithoutMatch);
    (eventDetector.detectCandidate as jest.Mock).mockResolvedValue({
      confidence: 0.75,
      motionSpike: 0.4,
      windowSize: 5,
      description: 'pico de movimento',
    });

    await worker.process(buildJob());

    expect(prisma.frameSample.update).toHaveBeenCalled();
    expect(prisma.gameEvent.create).not.toHaveBeenCalled();
    expect(aiCoachService.generateEventFeedback).not.toHaveBeenCalled();
  });

  it('não cria GameEvent quando a confiança do candidato está abaixo do limiar mínimo', async () => {
    prisma.captureSession.findUnique.mockResolvedValue(sessionWithMatch);
    (eventDetector.detectCandidate as jest.Mock).mockResolvedValue({
      confidence: 0.4,
      motionSpike: 0.2,
      windowSize: 5,
      description: 'pico fraco',
    });

    await worker.process(buildJob());

    expect(prisma.gameEvent.create).not.toHaveBeenCalled();
    expect(aiCoachService.generateEventFeedback).not.toHaveBeenCalled();
  });

  it('cria GameEvent mas não gera feedback quando a confiança fica entre os dois limiares', async () => {
    prisma.captureSession.findUnique.mockResolvedValue(sessionWithMatch);
    (eventDetector.detectCandidate as jest.Mock).mockResolvedValue({
      confidence: 0.6,
      motionSpike: 0.3,
      windowSize: 5,
      description: 'pico moderado',
    });

    await worker.process(buildJob());

    expect(prisma.gameEvent.create).toHaveBeenCalled();
    expect(aiCoachService.generateEventFeedback).not.toHaveBeenCalled();
  });

  it('não lança quando a sessão do job não existe mais', async () => {
    prisma.captureSession.findUnique.mockResolvedValue(null);

    await expect(worker.process(buildJob())).resolves.toBeUndefined();
    expect(prisma.frameSample.update).not.toHaveBeenCalled();
  });
});
