import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const message =
      exception.code === 'LIMIT_FILE_SIZE'
        ? 'Arquivo muito grande. Tamanho máximo: 1GB.'
        : `Erro no upload: ${exception.message}`;

    res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
