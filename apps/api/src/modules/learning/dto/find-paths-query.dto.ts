import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LearningLevel } from '@prisma/client';

export class FindPathsQueryDto {
  @IsString()
  gameId!: string;

  @IsOptional()
  @IsEnum(LearningLevel)
  level?: LearningLevel;
}
