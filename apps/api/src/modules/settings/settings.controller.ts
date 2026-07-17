import { Body, Controller, Get, Put } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto';
import { Roles } from '../../shared/decorators/roles.decorator';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('ai-provider')
  @Roles('admin')
  getAiProviderStatus() {
    return this.settingsService.getAiProviderStatus();
  }

  @Put('ai-provider')
  @Roles('admin')
  updateAiProviderKeys(@Body() dto: UpdateAiProviderDto) {
    return this.settingsService.updateAiProviderKeys(dto);
  }
}
