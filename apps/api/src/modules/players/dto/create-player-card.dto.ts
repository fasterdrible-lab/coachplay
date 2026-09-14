import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePlayerCardDto {
  @IsString()
  externalId!: string;

  @IsString()
  cardType!: string;

  @IsString()
  version!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  overallBase!: number;

  @IsInt()
  @Min(1)
  maxLevel!: number;

  @IsString()
  position!: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsString()
  dataVersion!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  sourceVersion?: string;
}
