import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CaptureSourceType } from '@prisma/client';

export class CreateCaptureSessionDto {
  @IsOptional()
  @IsString()
  matchId?: string;

  @IsEnum(CaptureSourceType)
  sourceType!: CaptureSourceType;

  @IsString()
  sourceName!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  resolutionWidth?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  resolutionHeight?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  captureFps?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  analysisFps?: number;
}
