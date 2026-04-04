import { PartialType } from '@nestjs/swagger';
import { CreateAccountReconciliationDto } from '@modules/account-balances/dtos/create-account-reconciliation.dto';

export class UpdateAccountReconciliationDto extends PartialType(
  CreateAccountReconciliationDto,
) {}
