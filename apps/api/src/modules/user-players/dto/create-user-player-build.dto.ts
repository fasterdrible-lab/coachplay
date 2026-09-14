import { IsInt, IsNumber, IsObject, IsString, Min } from 'class-validator';

export class CreateUserPlayerBuildDto {
  @IsString()
  strategy!: string;

  @IsString()
  position!: string;

  @IsInt()
  @Min(1)
  level!: number;

  @IsObject()
  allocation!: Record<string, number>;

  @IsObject()
  computedAttributes!: Record<string, number>;

  @IsNumber()
  roleScore!: number;

  @IsInt()
  @Min(0)
  totalPointsUsed!: number;

  @IsInt()
  @Min(0)
  totalPointsAvailable!: number;
}
