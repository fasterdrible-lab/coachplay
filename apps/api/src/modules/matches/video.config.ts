import { BadRequestException } from '@nestjs/common';
import { diskStorage, FileFilterCallback } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { Request } from 'express';

const ALLOWED_MIMETYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];

export const MAX_VIDEO_SIZE = 1024 * 1024 * 1024; // 1 GB

export const videoStorage = diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    const uploadDir = process.env.UPLOAD_DIR ?? 'uploads';
    const videoDir = join(process.cwd(), uploadDir, 'videos');
    mkdirSync(videoDir, { recursive: true });
    cb(null, videoDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const matchId = (req as any).params?.id ?? 'unknown';
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${matchId}-${Date.now()}${ext}`);
  },
});

export const videoFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Formato inválido. Permitido: MP4, MOV (QuickTime) e AVI.'));
  }
};
