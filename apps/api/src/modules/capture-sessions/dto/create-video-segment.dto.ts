import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SegmentReason } from '@prisma/client';

export class CreateVideoSegmentDto {
  @IsOptional()
  @IsString()
  matchId?: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  startTimestampMs!: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  endTimestampMs!: number;

  @IsOptional()
  @IsEnum(SegmentReason)
  reason?: SegmentReason;
}
