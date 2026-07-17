import { BadRequestException } from '@nestjs/common';
import { diskStorage, FileFilterCallback } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { Request } from 'express';

const ALLOWED_FRAME_MIMETYPES = ['image/png', 'image/jpeg', 'image/webp'];
const ALLOWED_SEGMENT_MIMETYPES = ['video/mp4'];

export const MAX_FRAME_SIZE = 5 * 1024 * 1024; // 5 MB — frame único, resolução reduzida
export const MAX_SEGMENT_SIZE = 50 * 1024 * 1024; // 50 MB — clipe curto (10–30s)

export const frameStorage = diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    const uploadDir = process.env.UPLOAD_DIR ?? 'uploads';
    const dir = join(process.cwd(), uploadDir, 'frames');
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const sessionId = (req as any).params?.id ?? 'unknown';
    const ext = extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${sessionId}-${Date.now()}${ext}`);
  },
});

export const frameFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (ALLOWED_FRAME_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Formato de frame inválido. Permitido: PNG, JPEG e WEBP.'));
  }
};

export const segmentStorage = diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    const uploadDir = process.env.UPLOAD_DIR ?? 'uploads';
    const dir = join(process.cwd(), uploadDir, 'segments');
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const sessionId = (req as any).params?.id ?? 'unknown';
    const ext = extname(file.originalname).toLowerCase() || '.mp4';
    cb(null, `${sessionId}-${Date.now()}${ext}`);
  },
});

export const segmentFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (ALLOWED_SEGMENT_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Formato de segmento inválido. Permitido: MP4.'));
  }
};
