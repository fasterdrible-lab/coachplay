import { Type } from 'class-transformer';
import { IsString, ValidateNested } from 'class-validator';
import { BuildInputDto } from './build-input.dto';

export class CompareBuildsDto {
  @IsString()
  cardId!: string;

  @IsString()
  position!: string;

  @ValidateNested()
  @Type(() => BuildInputDto)
  buildA!: BuildInputDto;

  @ValidateNested()
  @Type(() => BuildInputDto)
  buildB!: BuildInputDto;
}
