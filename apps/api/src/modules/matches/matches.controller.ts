import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { FindMatchesQueryDto } from './dto/find-matches-query.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthUser } from '../../shared/types/auth-user.type';
import { MAX_VIDEO_SIZE, videoFileFilter, videoStorage } from './video.config';
import { AnalysisLimitGuard } from '../plans/guards/analysis-limit.guard';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post()
  create(@Body() dto: CreateMatchDto, @CurrentUser() user: AuthUser) {
    return this.matchesService.create(dto, user);
  }

  @Get()
  findAll(@Query() query: FindMatchesQueryDto, @CurrentUser() user: AuthUser) {
    return this.matchesService.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.matchesService.findOne(id, user);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMatchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.matchesService.update(id, dto, user);
  }

  @Post(':id/video')
  @UseGuards(AnalysisLimitGuard)
  @UseInterceptors(
    FileInterceptor('video', {
      storage: videoStorage,
      fileFilter: videoFileFilter,
      limits: { fileSize: MAX_VIDEO_SIZE },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  uploadVideo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado. Use o campo "video".');
    return this.matchesService.uploadVideo(id, file, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.matchesService.remove(id, user);
  }
}
