import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class EvaluatePackDto {
  @IsString()
  packId!: string;

  @IsInt()
  @Min(0)
  userCoins!: number;

  @IsOptional()
  @IsString()
  userSquadId?: string;
}
