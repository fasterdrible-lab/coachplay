import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CaptureSessionsService } from './capture-sessions.service';
import { CreateCaptureSessionDto } from './dto/create-capture-session.dto';
import { StopCaptureSessionDto } from './dto/stop-capture-session.dto';
import { CreateFrameSampleDto } from './dto/create-frame-sample.dto';
import { CreateVideoSegmentDto } from './dto/create-video-segment.dto';
import {
  MAX_FRAME_SIZE,
  MAX_SEGMENT_SIZE,
  frameFileFilter,
  frameStorage,
  segmentFileFilter,
  segmentStorage,
} from './capture.config';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/types/auth-user.type';

@Controller('capture-sessions')
export class CaptureSessionsController {
  constructor(private readonly captureSessionsService: CaptureSessionsService) {}

  @Post()
  create(@Body() dto: CreateCaptureSessionDto, @CurrentUser() user: AuthUser) {
    return this.captureSessionsService.create(dto, user);
  }

  @Patch(':id/pause')
  pause(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.captureSessionsService.pause(id, user);
  }

  @Patch(':id/resume')
  resume(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.captureSessionsService.resume(id, user);
  }

  @Patch(':id/stop')
  stop(
    @Param('id') id: string,
    @Body() dto: StopCaptureSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.captureSessionsService.stop(id, user, dto);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.captureSessionsService.getStatus(id, user);
  }

  @Post(':id/frames')
  @Throttle({ default: { ttl: 60_000, limit: 300 } })
  @UseInterceptors(
    FileInterceptor('frame', {
      storage: frameStorage,
      fileFilter: frameFileFilter,
      limits: { fileSize: MAX_FRAME_SIZE },
    }),
  )
  addFrame(
    @Param('id') id: string,
    @Body() dto: CreateFrameSampleDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Nenhum frame enviado. Use o campo "frame".');
    return this.captureSessionsService.addFrame(id, dto, file, user);
  }

  @Post(':id/segments')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @UseInterceptors(
    FileInterceptor('segment', {
      storage: segmentStorage,
      fileFilter: segmentFileFilter,
      limits: { fileSize: MAX_SEGMENT_SIZE },
    }),
  )
  addSegment(
    @Param('id') id: string,
    @Body() dto: CreateVideoSegmentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Nenhum segmento enviado. Use o campo "segment".');
    return this.captureSessionsService.addSegment(id, dto, file, user);
  }
}
