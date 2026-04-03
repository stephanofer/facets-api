import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ERROR_CODES } from '@common/constants/app.constants';
import { BusinessException } from '@common/exceptions/business.exception';
import { getAccountTypeDefinition } from '@modules/accounts/domain/account-type-definitions';
import { AccountType } from '@/generated/prisma/client';
import { ValidatedAccountProfilePayload } from '@modules/accounts/domain/account-type-definition.interface';

@Injectable()
export class AccountProfilePayloadValidator {
  validateForCreate(
    type: AccountType,
    payload: unknown,
  ): ValidatedAccountProfilePayload | null {
    return this.validate(type, payload, 'createDto');
  }

  validateForUpdate(
    type: AccountType,
    payload: unknown,
  ): ValidatedAccountProfilePayload | null {
    return this.validate(type, payload, 'updateDto');
  }

  private validate(
    type: AccountType,
    payload: unknown,
    dtoKey: 'createDto' | 'updateDto',
  ): ValidatedAccountProfilePayload | null {
    const definition = getAccountTypeDefinition(type);

    if (definition.profileKind === 'NONE') {
      if (payload !== undefined && payload !== null) {
        throw new BusinessException(
          ERROR_CODES.ACCOUNT_PROFILE_INCOMPATIBLE,
          `Account type ${type} does not accept a specialized profile`,
          HttpStatus.BAD_REQUEST,
        );
      }

      return null;
    }

    if (payload === undefined || payload === null) {
      return null;
    }

    if (typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION_ERROR,
        'Profile payload must be an object',
        HttpStatus.BAD_REQUEST,
        [{ field: 'profile', message: 'profile must be an object' }],
      );
    }

    const dtoClass = definition[dtoKey];

    if (!dtoClass) {
      throw new BusinessException(
        ERROR_CODES.ACCOUNT_PROFILE_INCOMPATIBLE,
        `Account type ${type} does not support profile payloads in this operation`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const instance = plainToInstance(dtoClass, payload);
    const errors = validateSync(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION_ERROR,
        'Validation failed',
        HttpStatus.BAD_REQUEST,
        errors.flatMap((error) =>
          Object.values(error.constraints ?? {}).map((message) => ({
            field: error.property ? `profile.${error.property}` : 'profile',
            message,
          })),
        ),
      );
    }

    return {
      kind: definition.profileKind,
      data: instance as Record<string, unknown>,
    };
  }
}
