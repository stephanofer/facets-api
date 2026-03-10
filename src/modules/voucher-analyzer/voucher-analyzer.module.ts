import { Module } from '@nestjs/common';
import { VoucherAnalyzerController } from '@modules/voucher-analyzer/voucher-analyzer.controller';
import { VoucherAnalyzerService } from '@modules/voucher-analyzer/voucher-analyzer.service';

@Module({
  controllers: [VoucherAnalyzerController],
  providers: [VoucherAnalyzerService],
  exports: [VoucherAnalyzerService],
})
export class VoucherAnalyzerModule {}
