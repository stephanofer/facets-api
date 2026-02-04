import { Module } from '@nestjs/common';
import { OtpService } from '@modules/otp/otp.service';
import { OtpRepository } from '@modules/otp/otp.repository';

@Module({
  providers: [OtpService, OtpRepository],
  exports: [OtpService],
})
export class OtpModule {}
