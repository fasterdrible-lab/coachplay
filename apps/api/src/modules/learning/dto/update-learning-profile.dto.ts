import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { LearningLevel } from '@prisma/client';

export class UpdateLearningProfileDto {
  @IsEnum(LearningLevel)
  level!: LearningLevel;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goals?: string[];
}
