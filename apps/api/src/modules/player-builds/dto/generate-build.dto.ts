import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { BUILD_STRATEGIES, BuildStrategy } from '../../player-build-engine/player-build-engine.config';

export class GenerateBuildDto {
  @IsString()
  playerCardId!: string;

  @IsInt()
  @Min(1)
  level!: number;

  @IsString()
  position!: string;

  @IsIn(BUILD_STRATEGIES)
  strategy!: BuildStrategy;

  @IsInt()
  @Min(0)
  availableProgressionPoints!: number;

  @IsOptional()
  @IsString()
  desiredRole?: string;

  @IsOptional()
  @IsString()
  userStyle?: string;
}
