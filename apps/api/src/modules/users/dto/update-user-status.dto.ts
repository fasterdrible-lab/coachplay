import { IsEnum } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus, { message: 'Status inválido. Use: active, inactive ou blocked' })
  status: UserStatus;
}
