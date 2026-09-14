import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePlayerDto {
  @IsString()
  gameId!: string;

  @IsString()
  externalId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  preferredFoot?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  height?: number;
}
