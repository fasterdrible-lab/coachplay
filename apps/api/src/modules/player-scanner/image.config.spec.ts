import { BadRequestException } from '@nestjs/common';
import { imageFileFilter } from './image.config';

function buildFile(mimetype: string): Express.Multer.File {
  return { mimetype } as Express.Multer.File;
}

// Tarefa 19 (segurança) — risco 5 da auditoria (`docs/efootball-architecture.md`): o Player
// Scanner é o único ponto do módulo eFootball que processa upload de imagem do usuário. Mesmo
// padrão de `video.config.spec.ts` (Task 7.2/7.3), que este arquivo não tinha até agora.
describe('imageFileFilter', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp'])('aceita o formato válido %s', (mimetype) => {
    const cb = jest.fn();

    imageFileFilter({} as any, buildFile(mimetype), cb);

    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it.each(['video/mp4', 'application/pdf', 'text/html', 'image/svg+xml', 'application/octet-stream'])(
    'rejeita formato inválido/perigoso (%s) com BadRequestException',
    (mimetype) => {
      const cb = jest.fn();

      imageFileFilter({} as any, buildFile(mimetype), cb);

      expect(cb).toHaveBeenCalledTimes(1);
      const [err, accepted] = cb.mock.calls[0];
      expect(err).toBeInstanceOf(BadRequestException);
      expect(accepted).toBeUndefined();
    },
  );
});
