import sharp = require('sharp');
import { InvalidImageError, preprocessImage } from './preprocess-image';

describe('preprocessImage', () => {
  it('lê metadata de uma imagem válida', async () => {
    const buffer = await sharp({
      create: { width: 40, height: 60, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .png()
      .toBuffer();

    const metadata = await preprocessImage(buffer);

    expect(metadata).toEqual({ width: 40, height: 60, format: 'png' });
  });

  it('rejeita bytes que não formam uma imagem (fixture "imagem inválida")', async () => {
    const garbage = Buffer.from('isto nao e uma imagem, so texto qualquer'.repeat(10));

    await expect(preprocessImage(garbage)).rejects.toThrow(InvalidImageError);
  });

  it('rejeita buffer vazio', async () => {
    await expect(preprocessImage(Buffer.alloc(0))).rejects.toThrow(InvalidImageError);
  });
});
