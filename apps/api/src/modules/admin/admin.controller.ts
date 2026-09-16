import { Controller, Get, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { UsageQueryDto } from './dto/usage-query.dto';
import { Roles } from '../../shared/decorators/roles.decorator';

@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('usage')
  getUsage(@Query() query: UsageQueryDto) {
    return this.adminService.getUsage(query);
  }

  // Observabilidade do módulo eFootball (Tarefa 21) — separado de GET /admin/usage (100% EA FC).
  @Get('efootball-ai-usage')
  getEfootballAiUsage() {
    return this.adminService.getEfootballAiUsage();
  }
}
