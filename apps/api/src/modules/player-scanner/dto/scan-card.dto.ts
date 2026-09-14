import { IsString } from 'class-validator';

export class ScanCardDto {
  @IsString()
  gameId!: string;
}
