import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/types/auth-user.type';
import { PlayerScannerService } from './player-scanner.service';
import { imageFileFilter, imageStorage, MAX_IMAGE_SIZE } from './image.config';
import { ScanCardDto } from './dto/scan-card.dto';

@Controller('player-scanner')
export class PlayerScannerController {
  constructor(private readonly playerScannerService: PlayerScannerService) {}

  // Processamento pesado por chamada (sharp + OCR/matching, Tarefa 7) — mesmo padrão de
  // POST /matches/:id/video (Task 7.3): limite dedicado, mais estrito que o default global
  // (60/min).
  @Post('scan')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseInterceptors(
    FileInterceptor('image', { storage: imageStorage, fileFilter: imageFileFilter, limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  scan(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ScanCardDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Nenhuma imagem enviada. Use o campo "image".');

    return this.playerScannerService.scan({
      userId: user.id,
      gameId: dto.gameId,
      imageBuffer: file.buffer,
    });
  }
}
