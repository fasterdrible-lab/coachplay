import { IsOptional, IsString } from 'class-validator';

export class SearchPlayersQueryDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  gameId?: string;
}
