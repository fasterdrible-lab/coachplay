import { IsOptional, IsString } from 'class-validator';

export class FindCardsQueryDto {
  @IsOptional()
  @IsString()
  playerId?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  cardType?: string;
}
