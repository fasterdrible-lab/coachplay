import { Controller, Get, Delete, Query, Param, HttpCode, HttpStatus } from '@nestjs/common';
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

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.auditLogsService.remove(id);
  }
}
