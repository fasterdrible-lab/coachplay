import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { MulterExceptionFilter } from './shared/filters/multer-exception.filter';

// Prisma retorna BigInt para campos como fileSize — garantir serialização JSON correta
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: config.get('FRONTEND_URL', 'http://localhost:3000'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter(), new MulterExceptionFilter());
  app.setGlobalPrefix('api/v1');

  // Servir arquivos de upload como assets estáticos em /uploads
  const uploadDir = config.get('UPLOAD_DIR', 'uploads');
  const staticRoot = join(process.cwd(), uploadDir);
  mkdirSync(join(staticRoot, 'videos'), { recursive: true });
  app.useStaticAssets(staticRoot, { prefix: '/uploads' });

  const port = config.get<number>('PORT', 3001);
  await app.listen(port);
}

bootstrap();
