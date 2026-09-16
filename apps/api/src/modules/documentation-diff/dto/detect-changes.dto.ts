import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class DetectChangesDto {
  @IsString()
  @IsNotEmpty()
  documentId!: string;

  @IsInt()
  @Min(1)
  oldVersionNumber!: number;

  @IsInt()
  @Min(1)
  newVersionNumber!: number;
}
