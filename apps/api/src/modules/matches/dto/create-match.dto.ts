import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMatchDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  gameMode?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsDateString()
  matchDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  scoreUser?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  scoreOpponent?: number;

  @IsOptional()
  @IsString()
  playerTeam?: string;
}
