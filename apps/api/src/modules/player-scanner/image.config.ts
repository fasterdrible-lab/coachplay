import { BadRequestException } from '@nestjs/common';
import { memoryStorage, FileFilterCallback } from 'multer';
import { Request } from 'express';

const ALLOWED_MIMETYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB — screenshot, não vídeo

// Em memória (não disco): o buffer é processado (sharp + OCR) e descartado, não é um asset
// permanente do usuário como o vídeo de partida.
export const imageStorage = memoryStorage();

export const imageFileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Formato inválido. Permitido: PNG, JPEG ou WEBP.'));
  }
};
