import { IsString } from 'class-validator';

export class GenerateSquadDto {
  @IsString()
  gameId!: string;

  @IsString()
  formationCode!: string;
}
