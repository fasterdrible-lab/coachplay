import { Module } from '@nestjs/common';
import { EfootballDataProviderService } from './efootball-data-provider.service';

@Module({
  providers: [EfootballDataProviderService],
  exports: [EfootballDataProviderService],
})
export class EfootballDataProviderModule {}
