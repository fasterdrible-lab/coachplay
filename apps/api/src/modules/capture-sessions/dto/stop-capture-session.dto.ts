import { IsOptional, IsString } from 'class-validator';

export class StopCaptureSessionDto {
  @IsOptional()
  @IsString()
  errorMessage?: string;
}
