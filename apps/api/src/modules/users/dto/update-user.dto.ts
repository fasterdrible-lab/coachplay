import { IsString, IsOptional, IsBoolean, MinLength, MaxLength, IsIn } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Nome deve ter ao menos 2 caracteres' })
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(['simple', 'normal', 'detailed'])
  feedbackLevel?: string;

  @IsOptional()
  @IsBoolean()
  voiceEnabled?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['pt-BR', 'en-US', 'es-ES'])
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  favoriteMode?: string;
}
