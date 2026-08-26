import { IsOptional, IsString } from 'class-validator';

export class UpdateAiProviderDto {
  @IsOptional()
  @IsString()
  anthropicApiKey?: string;

  @IsOptional()
  @IsString()
  openaiApiKey?: string;

  @IsOptional()
  @IsString()
  deepSeekApiKey?: string;

  @IsOptional()
  @IsString()
  groqApiKey?: string;
}
