/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AccountsService } from '@modules/accounts/accounts.service';
import { AccountsRepository } from '@modules/accounts/accounts.repository';
import { SubscriptionsService } from '@modules/subscriptions/subscriptions.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_CODES } from '@common/constants/app.constants';
import { AccountType, Prisma } from '../../generated/prisma/client';

describe('AccountsService', () => {
  let service: AccountsService;
  let accountsRepository: jest.Mocked<AccountsRepository>;
  let subscriptionsService: jest.Mocked<SubscriptionsService>;

  const userId = 'test-user-id';

  const mockAccount = {
    id: 'account-id-1',
    userId,
    name: 'My Checking',
    type: AccountType.DEBIT_CARD,
    balance: new Prisma.Decimal(1500),
    currencyCode: 'USD',
    color: '#FF5733',
    icon: 'credit-card',
    includeInTotal: true,
    isArchived: false,
    creditLimit: null,
    statementClosingDay: null,
    paymentDueDay: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreditCardAccount = {
    ...mockAccount,
    id: 'account-id-2',
    name: 'Visa Gold',
    type: AccountType.CREDIT_CARD,
    creditLimit: new Prisma.Decimal(5000),
    statementClosingDay: 15,
    paymentDueDay: 5,
  };

  beforeEach(async () => {
    const mockAccountsRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      setArchived: jest.fn(),
      countActive: jest.fn(),
      hasTransactions: jest.fn(),
      nameExists: jest.fn(),
      getBalanceSummary: jest.fn(),
      currencyExists: jest.fn(),
    };

    const mockSubscriptionsService = {
      checkFeatureAccess: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: AccountsRepository, useValue: mockAccountsRepository },
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    accountsRepository = module.get(AccountsRepository);
    subscriptionsService = module.get(SubscriptionsService);
  });

  describe('create', () => {
    const createDto = {
      name: 'My Checking',
      type: AccountType.DEBIT_CARD,
      balance: 1500,
      currencyCode: 'USD',
    };

    it('should create an account successfully', async () => {
      accountsRepository.countActive.mockResolvedValue(2);
      subscriptionsService.checkFeatureAccess.mockResolvedValue({
        allowed: true,
        current: 2,
        limit: 5,
      });
      accountsRepository.currencyExists.mockResolvedValue(true);
      accountsRepository.nameExists.mockResolvedValue(false);
      accountsRepository.create.mockResolvedValue(mockAccount);

      const result = await service.create(userId, createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('My Checking');
      expect(result.type).toBe(AccountType.DEBIT_CARD);
      expect(accountsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          name: 'My Checking',
          type: AccountType.DEBIT_CARD,
        }),
      );
    });

    it('should throw when feature limit is exceeded', async () => {
      accountsRepository.countActive.mockResolvedValue(5);
      subscriptionsService.checkFeatureAccess.mockResolvedValue({
        allowed: false,
        current: 5,
        limit: 5,
        reason: 'FEATURE_LIMIT_EXCEEDED',
      });

      await expect(service.create(userId, createDto)).rejects.toThrow(
        BusinessException,
      );
      await expect(service.create(userId, createDto)).rejects.toMatchObject({
        code: ERROR_CODES.FEATURE_LIMIT_EXCEEDED,
      });
    });

    it('should throw when currency does not exist', async () => {
      accountsRepository.countActive.mockResolvedValue(0);
      subscriptionsService.checkFeatureAccess.mockResolvedValue({
        allowed: true,
        current: 0,
        limit: 5,
      });
      accountsRepository.currencyExists.mockResolvedValue(false);

      await expect(
        service.create(userId, { ...createDto, currencyCode: 'XYZ' }),
      ).rejects.toThrow(BusinessException);
    });

    it('should throw when account name already exists', async () => {
      accountsRepository.countActive.mockResolvedValue(0);
      subscriptionsService.checkFeatureAccess.mockResolvedValue({
        allowed: true,
        current: 0,
        limit: 5,
      });
      accountsRepository.currencyExists.mockResolvedValue(true);
      accountsRepository.nameExists.mockResolvedValue(true);

      await expect(service.create(userId, createDto)).rejects.toThrow(
        BusinessException,
      );
      await expect(service.create(userId, createDto)).rejects.toMatchObject({
        code: ERROR_CODES.ACCOUNT_DUPLICATE_NAME,
      });
    });

    it('should require credit limit for CREDIT_CARD type', async () => {
      accountsRepository.countActive.mockResolvedValue(0);
      subscriptionsService.checkFeatureAccess.mockResolvedValue({
        allowed: true,
        current: 0,
        limit: 5,
      });
      accountsRepository.currencyExists.mockResolvedValue(true);
      accountsRepository.nameExists.mockResolvedValue(false);

      const creditCardDto = {
        name: 'Visa',
        type: AccountType.CREDIT_CARD,
        // Missing creditLimit
      };

      await expect(service.create(userId, creditCardDto)).rejects.toThrow(
        BusinessException,
      );
      await expect(service.create(userId, creditCardDto)).rejects.toMatchObject(
        {
          code: ERROR_CODES.INVALID_CREDIT_CARD_FIELDS,
        },
      );
    });

    it('should reject credit card fields on non-credit card accounts', async () => {
      accountsRepository.countActive.mockResolvedValue(0);
      subscriptionsService.checkFeatureAccess.mockResolvedValue({
        allowed: true,
        current: 0,
        limit: 5,
      });
      accountsRepository.currencyExists.mockResolvedValue(true);
      accountsRepository.nameExists.mockResolvedValue(false);

      const invalidDto = {
        name: 'Cash',
        type: AccountType.CASH,
        creditLimit: 5000,
      };

      await expect(service.create(userId, invalidDto)).rejects.toThrow(
        BusinessException,
      );
      await expect(service.create(userId, invalidDto)).rejects.toMatchObject({
        code: ERROR_CODES.INVALID_CREDIT_CARD_FIELDS,
      });
    });

    it('should create a credit card account with all fields', async () => {
      accountsRepository.countActive.mockResolvedValue(0);
      subscriptionsService.checkFeatureAccess.mockResolvedValue({
        allowed: true,
        current: 0,
        limit: 5,
      });
      accountsRepository.currencyExists.mockResolvedValue(true);
      accountsRepository.nameExists.mockResolvedValue(false);
      accountsRepository.create.mockResolvedValue(mockCreditCardAccount);

      const creditCardDto = {
        name: 'Visa Gold',
        type: AccountType.CREDIT_CARD,
        creditLimit: 5000,
        statementClosingDay: 15,
        paymentDueDay: 5,
      };

      const result = await service.create(userId, creditCardDto);

      expect(result.creditLimit).toBe('5000');
      expect(result.statementClosingDay).toBe(15);
      expect(result.paymentDueDay).toBe(5);
    });
  });

  describe('findAll', () => {
    it('should return all active accounts by default', async () => {
      accountsRepository.findAll.mockResolvedValue([mockAccount]);

      const result = await service.findAll(userId, {});

      expect(result.accounts).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(accountsRepository.findAll).toHaveBeenCalledWith({
        userId,
        type: undefined,
        includeArchived: false,
        currencyCode: undefined,
      });
    });

    it('should filter by type', async () => {
      accountsRepository.findAll.mockResolvedValue([]);

      await service.findAll(userId, { type: AccountType.CREDIT_CARD });

      expect(accountsRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ type: AccountType.CREDIT_CARD }),
      );
    });
  });

  describe('findById', () => {
    it('should return an account', async () => {
      accountsRepository.findById.mockResolvedValue(mockAccount);

      const result = await service.findById(userId, mockAccount.id);
      expect(result.id).toBe(mockAccount.id);
    });

    it('should throw if account not found', async () => {
      accountsRepository.findById.mockResolvedValue(null);

      await expect(service.findById(userId, 'non-existent-id')).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('update', () => {
    it('should update an account', async () => {
      const updatedAccount = { ...mockAccount, name: 'Updated Name' };
      accountsRepository.findById.mockResolvedValue(mockAccount);
      accountsRepository.nameExists.mockResolvedValue(false);
      accountsRepository.update.mockResolvedValue(updatedAccount);

      const result = await service.update(userId, mockAccount.id, {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw on duplicate name during update', async () => {
      accountsRepository.findById.mockResolvedValue(mockAccount);
      accountsRepository.nameExists.mockResolvedValue(true);

      await expect(
        service.update(userId, mockAccount.id, { name: 'Existing Name' }),
      ).rejects.toMatchObject({ code: ERROR_CODES.ACCOUNT_DUPLICATE_NAME });
    });
  });

  describe('delete', () => {
    it('should delete an account with no transactions', async () => {
      accountsRepository.findById.mockResolvedValue(mockAccount);
      accountsRepository.hasTransactions.mockResolvedValue(false);

      await service.delete(userId, mockAccount.id);

      expect(accountsRepository.delete).toHaveBeenCalledWith(mockAccount.id);
    });

    it('should throw if account has transactions', async () => {
      accountsRepository.findById.mockResolvedValue(mockAccount);
      accountsRepository.hasTransactions.mockResolvedValue(true);

      await expect(
        service.delete(userId, mockAccount.id),
      ).rejects.toMatchObject({ code: ERROR_CODES.ACCOUNT_HAS_TRANSACTIONS });
    });
  });

  describe('archive / unarchive', () => {
    it('should archive an account', async () => {
      accountsRepository.findById.mockResolvedValue(mockAccount);
      accountsRepository.setArchived.mockResolvedValue({
        ...mockAccount,
        isArchived: true,
      });

      const result = await service.archive(userId, mockAccount.id);
      expect(result.isArchived).toBe(true);
    });

    it('should unarchive an account within limits', async () => {
      const archivedAccount = { ...mockAccount, isArchived: true };
      accountsRepository.findById.mockResolvedValue(archivedAccount);
      accountsRepository.countActive.mockResolvedValue(2);
      subscriptionsService.checkFeatureAccess.mockResolvedValue({
        allowed: true,
        current: 2,
        limit: 5,
      });
      accountsRepository.setArchived.mockResolvedValue({
        ...archivedAccount,
        isArchived: false,
      });

      const result = await service.unarchive(userId, archivedAccount.id);
      expect(result.isArchived).toBe(false);
    });

    it('should throw when unarchiving exceeds limit', async () => {
      const archivedAccount = { ...mockAccount, isArchived: true };
      accountsRepository.findById.mockResolvedValue(archivedAccount);
      accountsRepository.countActive.mockResolvedValue(5);
      subscriptionsService.checkFeatureAccess.mockResolvedValue({
        allowed: false,
        current: 5,
        limit: 5,
        reason: 'FEATURE_LIMIT_EXCEEDED',
      });

      await expect(
        service.unarchive(userId, archivedAccount.id),
      ).rejects.toMatchObject({ code: ERROR_CODES.FEATURE_LIMIT_EXCEEDED });
    });

    it('should throw when unarchiving a non-archived account', async () => {
      accountsRepository.findById.mockResolvedValue(mockAccount);

      await expect(
        service.unarchive(userId, mockAccount.id),
      ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_ERROR });
    });
  });

  describe('getBalanceSummary', () => {
    it('should return balance summary grouped by currency', async () => {
      accountsRepository.getBalanceSummary.mockResolvedValue([
        {
          currencyCode: 'USD',
          _sum: { balance: new Prisma.Decimal(5500) },
          _count: 3,
        },
      ]);
      accountsRepository.countActive.mockResolvedValue(3);

      const result = await service.getBalanceSummary(userId);

      expect(result.balances).toHaveLength(1);
      expect(result.balances[0].currencyCode).toBe('USD');
      expect(result.totalAccounts).toBe(3);
    });
  });
});
