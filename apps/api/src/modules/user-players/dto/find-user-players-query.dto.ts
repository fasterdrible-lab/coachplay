import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class FindUserPlayersQueryDto {
  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  cardType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minOverall?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxOverall?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  level?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  favorite?: boolean;
}
