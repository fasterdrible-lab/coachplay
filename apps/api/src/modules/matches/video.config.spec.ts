import { BadRequestException } from '@nestjs/common';
import { videoFileFilter } from './video.config';

function buildFile(mimetype: string): Express.Multer.File {
  return { mimetype } as Express.Multer.File;
}

describe('videoFileFilter', () => {
  it.each(['video/mp4', 'video/quicktime', 'video/x-msvideo'])(
    'aceita o formato válido %s',
    (mimetype) => {
      const cb = jest.fn();

      videoFileFilter({} as any, buildFile(mimetype), cb);

      expect(cb).toHaveBeenCalledWith(null, true);
    },
  );

  it('rejeita formato inválido (ex.: image/png) com BadRequestException', () => {
    const cb = jest.fn();

    videoFileFilter({} as any, buildFile('image/png'), cb);

    expect(cb).toHaveBeenCalledTimes(1);
    const [err, accepted] = cb.mock.calls[0];
    expect(err).toBeInstanceOf(BadRequestException);
    expect(accepted).toBeUndefined();
  });
});
