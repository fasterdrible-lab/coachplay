import { ConfigService } from '@nestjs/config';

jest.mock('fluent-ffmpeg', () => {
  const chainable: any = {
    __handlers: {} as Record<string, (...args: unknown[]) => void>,
    __shouldFail: false,
    __failError: new Error('ffmpeg failed'),
    seekInput: jest.fn(function (this: any) {
      return this;
    }),
    outputOptions: jest.fn(function (this: any) {
      return this;
    }),
    output: jest.fn(function (this: any) {
      return this;
    }),
    on: jest.fn(function (this: any, event: string, cb: (...args: unknown[]) => void) {
      this.__handlers[event] = cb;
      return this;
    }),
    run: jest.fn(function (this: any) {
      if (this.__shouldFail) this.__handlers.error?.(this.__failError);
      else this.__handlers.end?.();
    }),
  };

  const fn: any = jest.fn(() => chainable);
  fn.setFfmpegPath = jest.fn();
  fn.setFfprobePath = jest.fn();
  fn.__chainable = chainable;
  return fn;
});
jest.mock('@ffmpeg-installer/ffmpeg', () => ({ path: '/fake/ffmpeg' }));
jest.mock('ffprobe-static', () => ({ path: '/fake/ffprobe' }));

import * as ffmpegModule from 'fluent-ffmpeg';
import { VideoCaptureService } from './video-capture.service';

const mockFfmpeg = ffmpegModule as unknown as jest.Mock & { __chainable: any };
const chainable = mockFfmpeg.__chainable;

describe('VideoCaptureService — extractFrameAt', () => {
  let service: VideoCaptureService;

  beforeEach(() => {
    mockFfmpeg.mockClear();
    chainable.seekInput.mockClear();
    chainable.outputOptions.mockClear();
    chainable.output.mockClear();
    chainable.on.mockClear();
    chainable.run.mockClear();
    chainable.__handlers = {};
    chainable.__shouldFail = false;

    const config = { get: jest.fn((_key: string, fallback?: string) => fallback) } as unknown as ConfigService;
    service = new VideoCaptureService(config);
  });

  it('extrai 1 frame no timestamp exato via seekInput', async () => {
    await service.extractFrameAt('/tmp/video.mp4', 123.7, '/tmp/out/frame.jpg');

    expect(mockFfmpeg).toHaveBeenCalledWith('/tmp/video.mp4');
    expect(chainable.seekInput).toHaveBeenCalledWith(123.7);
    expect(chainable.outputOptions).toHaveBeenCalledWith(['-frames:v 1', '-q:v 2']);
    expect(chainable.output).toHaveBeenCalledWith('/tmp/out/frame.jpg');
  });

  it('nunca manda timestamp negativo pro ffmpeg', async () => {
    await service.extractFrameAt('/tmp/video.mp4', -5, '/tmp/out/frame.jpg');

    expect(chainable.seekInput).toHaveBeenCalledWith(0);
  });

  it('propaga erro do ffmpeg com o timestamp na mensagem', async () => {
    chainable.__shouldFail = true;
    chainable.__failError = new Error('boom');

    await expect(
      service.extractFrameAt('/tmp/video.mp4', 42, '/tmp/out/frame.jpg'),
    ).rejects.toThrow(/42s.*boom/);
  });
});
