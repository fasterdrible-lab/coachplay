import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFrameSampleDto {
  @IsInt()
  @Min(0)
  @Type(() => Number)
  timestampMs!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  height?: number;
}
