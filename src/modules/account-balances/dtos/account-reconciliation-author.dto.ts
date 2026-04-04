import { ApiProperty } from '@nestjs/swagger';

export class AccountReconciliationAuthorDto {
  @ApiProperty({ example: 'cusr_123456789' })
  id: string;

  @ApiProperty({ example: 'owner@test.com' })
  email: string;

  @ApiProperty({ example: 'Stephano' })
  firstName: string;

  @ApiProperty({ example: 'Fer' })
  lastName: string;
}
