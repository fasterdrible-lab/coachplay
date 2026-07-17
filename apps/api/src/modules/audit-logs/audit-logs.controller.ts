import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto';
import { Roles } from '../../shared/decorators/roles.decorator';

@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Roles('admin')
  findAll(@Query() query: FindAuditLogsQueryDto) {
    return this.auditLogsService.findAll(query);
  }
}
