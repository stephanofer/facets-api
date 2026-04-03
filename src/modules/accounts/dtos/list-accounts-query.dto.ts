import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { AccountStatus } from '@/generated/prisma/client';

export class ListAccountsQueryDto {
  @ApiPropertyOptional({
    enum: AccountStatus,
    example: AccountStatus.ACTIVE,
    description: 'Optional lifecycle filter. Defaults to ACTIVE when omitted.',
  })
  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;
}
