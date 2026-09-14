import { IsInt, IsObject, Min } from 'class-validator';

export class BuildInputDto {
  @IsObject()
  allocation!: Record<string, number>;

  @IsInt()
  @Min(0)
  availableProgressionPoints!: number;
}
