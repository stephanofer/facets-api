import { Type } from 'class-transformer';
import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  IsDate,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

class AccountProfileDtoBase {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  issuerName?: string;
}

export class CreateCreditCardProfileDto extends AccountProfileDtoBase {
  @ApiPropertyOptional({ example: '1234', nullable: true })
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'last4 must contain exactly 4 digits' })
  last4?: string;

  @ApiPropertyOptional({ example: 5000, nullable: true, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({ example: 25, nullable: true, minimum: 1, maximum: 31 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  closingDayOfMonth?: number;

  @ApiPropertyOptional({ example: 10, nullable: true, minimum: 1, maximum: 31 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dueDayOfMonth?: number;
}

export class UpdateCreditCardProfileDto extends CreateCreditCardProfileDto {}

export class CreateDebtProfileDto {
  @ApiPropertyOptional({ example: 'Visa Banco', nullable: true })
  @IsOptional()
  @IsString()
  creditorName?: string;

  @ApiPropertyOptional({ example: '2026-04-30', nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;

  @ApiPropertyOptional({ example: 'resumen-marzo', nullable: true })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ example: 'Pago en cuotas', nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDebtProfileDto extends CreateDebtProfileDto {}

export class CreateLoanProfileDto {
  @ApiPropertyOptional({ example: 'Banco Nación', nullable: true })
  @IsOptional()
  @IsString()
  lenderName?: string;

  @ApiPropertyOptional({ example: 12.5, nullable: true, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  interestRate?: number;

  @ApiPropertyOptional({ example: 350, nullable: true, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  estimatedInstallmentAmount?: number;

  @ApiPropertyOptional({ example: 24, nullable: true, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  termMonths?: number;

  @ApiPropertyOptional({ example: 15, nullable: true, minimum: 1, maximum: 31 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dueDayOfMonth?: number;

  @ApiPropertyOptional({ example: '2026-01-10', nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startedAt?: Date;

  @ApiPropertyOptional({ example: '2028-01-10', nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  maturityDate?: Date;
}

export class UpdateLoanProfileDto extends CreateLoanProfileDto {}

export class CreateLentMoneyProfileDto {
  @ApiPropertyOptional({ example: 'Juan Pérez', nullable: true })
  @IsOptional()
  @IsString()
  borrowerName?: string;

  @ApiPropertyOptional({ example: '2026-07-10', nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expectedRepaymentDate?: Date;

  @ApiPropertyOptional({ example: 'Prestado para viaje', nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLentMoneyProfileDto extends CreateLentMoneyProfileDto {}

export class CreditCardProfileResponseDto {
  @ApiProperty({ example: 'Visa', nullable: true })
  issuerName: string | null;

  @ApiProperty({ example: '1234', nullable: true })
  last4: string | null;

  @ApiProperty({ example: '5000', nullable: true })
  creditLimit: string | null;

  @ApiProperty({ example: 25, nullable: true })
  closingDayOfMonth: number | null;

  @ApiProperty({ example: 10, nullable: true })
  dueDayOfMonth: number | null;
}

export class DebtProfileResponseDto {
  @ApiProperty({ example: 'Visa Banco', nullable: true })
  creditorName: string | null;

  @ApiProperty({ example: '2026-04-30T00:00:00.000Z', nullable: true })
  dueDate: string | null;

  @ApiProperty({ example: 'resumen-marzo', nullable: true })
  reference: string | null;

  @ApiProperty({ example: 'Pago en cuotas', nullable: true })
  notes: string | null;
}

export class LoanProfileResponseDto {
  @ApiProperty({ example: 'Banco Nación', nullable: true })
  lenderName: string | null;

  @ApiProperty({ example: '12.5', nullable: true })
  interestRate: string | null;

  @ApiProperty({ example: '350', nullable: true })
  estimatedInstallmentAmount: string | null;

  @ApiProperty({ example: 24, nullable: true })
  termMonths: number | null;

  @ApiProperty({ example: 15, nullable: true })
  dueDayOfMonth: number | null;

  @ApiProperty({ example: '2026-01-10T00:00:00.000Z', nullable: true })
  startedAt: string | null;

  @ApiProperty({ example: '2028-01-10T00:00:00.000Z', nullable: true })
  maturityDate: string | null;
}

export class LentMoneyProfileResponseDto {
  @ApiProperty({ example: 'Juan Pérez', nullable: true })
  borrowerName: string | null;

  @ApiProperty({ example: '2026-07-10T00:00:00.000Z', nullable: true })
  expectedRepaymentDate: string | null;

  @ApiProperty({ example: 'Prestado para viaje', nullable: true })
  notes: string | null;
}

export class AccountProfileRequestUnionDto {
  @ApiPropertyOptional({
    nullable: true,
    oneOf: [
      { $ref: getSchemaPath(CreateCreditCardProfileDto) },
      { $ref: getSchemaPath(CreateDebtProfileDto) },
      { $ref: getSchemaPath(CreateLoanProfileDto) },
      { $ref: getSchemaPath(CreateLentMoneyProfileDto) },
    ],
  })
  @IsOptional()
  @IsObject()
  profile?: unknown;
}

export class AccountProfileResponseUnionDto {
  @ApiProperty({
    nullable: true,
    oneOf: [
      { $ref: getSchemaPath(CreditCardProfileResponseDto) },
      { $ref: getSchemaPath(DebtProfileResponseDto) },
      { $ref: getSchemaPath(LoanProfileResponseDto) },
      { $ref: getSchemaPath(LentMoneyProfileResponseDto) },
    ],
  })
  profile:
    | CreditCardProfileResponseDto
    | DebtProfileResponseDto
    | LoanProfileResponseDto
    | LentMoneyProfileResponseDto
    | null;
}
