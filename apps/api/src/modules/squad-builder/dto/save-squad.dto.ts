import { IsString } from 'class-validator';
import { GenerateSquadDto } from './generate-squad.dto';

export class SaveSquadDto extends GenerateSquadDto {
  @IsString()
  name!: string;
}
