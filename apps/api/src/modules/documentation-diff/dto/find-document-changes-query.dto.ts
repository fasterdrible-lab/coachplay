import { DocumentChangeReviewStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class FindDocumentChangesQueryDto {
  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsEnum(DocumentChangeReviewStatus)
  reviewStatus?: DocumentChangeReviewStatus;
}
