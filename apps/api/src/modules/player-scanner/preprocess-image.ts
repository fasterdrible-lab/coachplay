// `sharp` usa `export =` (CJS puro, sem `.default`) — sob o tsconfig deste projeto
// (esModuleInterop desligado), `import sharp from 'sharp'` compilaria para `sharp_1.default`,
// que não existe em runtime. `import ... = require(...)` é a forma correta (mesmo padrão de
// game-state-detector.service.ts).
import sharp = require('sharp');

export class InvalidImageError extends Error {}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
}

/** Passo "pré-processamento" — valida que o upload é mesmo uma imagem decodificável antes de
 * gastar qualquer OCR/matching nela. Rejeita bytes corrompidos/não-imagem (fixture "imagem
 * inválida"). */
export async function preprocessImage(buffer: Buffer): Promise<ImageMetadata> {
  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height || !metadata.format) {
      throw new Error('metadata incompleta');
    }
    return { width: metadata.width, height: metadata.height, format: metadata.format };
  } catch (err) {
    throw new InvalidImageError(`Imagem inválida ou corrompida: ${(err as Error).message}`);
  }
}
