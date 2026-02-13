import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateAccountDto } from '@modules/accounts/dtos/create-account.dto';

/**
 * Update account DTO.
 *
 * All fields are optional. `type` and `currencyCode` cannot be changed
 * after creation (changing currency would require recalculating all
 * transaction amounts, changing type could break business logic).
 */
export class UpdateAccountDto extends PartialType(
  OmitType(CreateAccountDto, ['type', 'currencyCode'] as const),
) {}
