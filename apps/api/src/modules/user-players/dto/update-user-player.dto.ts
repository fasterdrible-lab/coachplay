import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateUserPlayerDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  currentLevel?: number;

  @IsOptional()
  @IsString()
  favoritePosition?: string;

  @IsOptional()
  @IsString()
  userNotes?: string;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}
