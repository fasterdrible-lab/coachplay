import { Module } from '@nestjs/common';
import { PlayerScannerController } from './player-scanner.controller';
import { PlayerScannerService } from './player-scanner.service';
import { CARD_IMAGE_EXTRACTOR } from './card-image-extractor.interface';
import { NotConfiguredCardImageExtractor } from './not-configured-card-image-extractor';

@Module({
  controllers: [PlayerScannerController],
  providers: [
    PlayerScannerService,
    { provide: CARD_IMAGE_EXTRACTOR, useClass: NotConfiguredCardImageExtractor },
  ],
  exports: [PlayerScannerService],
})
export class PlayerScannerModule {}
