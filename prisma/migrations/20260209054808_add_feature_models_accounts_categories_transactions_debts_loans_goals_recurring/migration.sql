-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'SAVINGS', 'INVESTMENT', 'DIGITAL_WALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EXPENSE', 'INCOME', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'RECURRING', 'IMPORT');

-- CreateEnum
CREATE TYPE "DebtDirection" AS ENUM ('I_OWE', 'THEY_OWE');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('ACTIVE', 'SETTLED', 'FORGIVEN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoanDirection" AS ENUM ('BORROWED', 'LENT');

-- CreateEnum
CREATE TYPE "InterestType" AS ENUM ('FIXED', 'VARIABLE');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'PAID_OFF', 'DEFAULTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoanPaymentStatus" AS ENUM ('PENDING', 'DUE', 'PAID', 'LATE', 'MISSED');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "RecurringStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "AccountType" NOT NULL,
    "balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "color" VARCHAR(7),
    "icon" VARCHAR(50),
    "includeInTotal" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "creditLimit" DECIMAL(19,4),
    "statementClosingDay" INTEGER,
    "paymentDueDay" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "parentId" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "icon" VARCHAR(50),
    "color" VARCHAR(7),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "exchangeRate" DECIMAL(19,10),
    "accountId" TEXT NOT NULL,
    "transferToAccountId" TEXT,
    "categoryId" TEXT,
    "description" VARCHAR(500),
    "notes" TEXT,
    "date" DATE NOT NULL,
    "attachments" JSONB,
    "tags" JSONB,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "isPending" BOOLEAN NOT NULL DEFAULT false,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "recurringPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "counterpartyName" VARCHAR(200) NOT NULL,
    "direction" "DebtDirection" NOT NULL,
    "originalAmount" DECIMAL(19,4) NOT NULL,
    "remainingAmount" DECIMAL(19,4) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "description" VARCHAR(500),
    "notes" TEXT,
    "dueDate" DATE,
    "settledAt" TIMESTAMP(3),
    "status" "DebtStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_payments" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "accountId" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lenderName" VARCHAR(200) NOT NULL,
    "direction" "LoanDirection" NOT NULL,
    "principalAmount" DECIMAL(19,4) NOT NULL,
    "remainingBalance" DECIMAL(19,4) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "interestRate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "interestType" "InterestType" NOT NULL DEFAULT 'FIXED',
    "totalInstallments" INTEGER NOT NULL,
    "paidInstallments" INTEGER NOT NULL DEFAULT 0,
    "monthlyPayment" DECIMAL(19,4) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "nextPaymentDate" DATE,
    "description" VARCHAR(500),
    "notes" TEXT,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_payments" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "principalAmount" DECIMAL(19,4) NOT NULL,
    "interestAmount" DECIMAL(19,4) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "accountId" TEXT,
    "dueDate" DATE NOT NULL,
    "paidAt" TIMESTAMP(3),
    "status" "LoanPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "targetAmount" DECIMAL(19,4) NOT NULL,
    "currentAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "color" VARCHAR(7),
    "icon" VARCHAR(50),
    "targetDate" DATE,
    "completedAt" TIMESTAMP(3),
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_contributions" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "accountId" TEXT,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "description" VARCHAR(500),
    "frequency" "RecurringFrequency" NOT NULL,
    "frequencyInterval" INTEGER NOT NULL DEFAULT 1,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "nextOccurrence" DATE,
    "lastGeneratedAt" TIMESTAMP(3),
    "occurrencesCount" INTEGER NOT NULL DEFAULT 0,
    "maxOccurrences" INTEGER,
    "notifyBeforeDays" INTEGER NOT NULL DEFAULT 0,
    "status" "RecurringStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_userId_isArchived_idx" ON "accounts"("userId", "isArchived");

-- CreateIndex
CREATE INDEX "accounts_userId_type_idx" ON "accounts"("userId", "type");

-- CreateIndex
CREATE INDEX "accounts_userId_currencyCode_idx" ON "accounts"("userId", "currencyCode");

-- CreateIndex
CREATE INDEX "categories_userId_type_isActive_idx" ON "categories"("userId", "type", "isActive");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE INDEX "categories_isSystem_type_isActive_idx" ON "categories"("isSystem", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "categories_userId_name_type_parentId_key" ON "categories"("userId", "name", "type", "parentId");

-- CreateIndex
CREATE INDEX "transactions_userId_date_idx" ON "transactions"("userId", "date" DESC);

-- CreateIndex
CREATE INDEX "transactions_userId_accountId_date_idx" ON "transactions"("userId", "accountId", "date" DESC);

-- CreateIndex
CREATE INDEX "transactions_userId_type_date_idx" ON "transactions"("userId", "type", "date" DESC);

-- CreateIndex
CREATE INDEX "transactions_userId_categoryId_date_idx" ON "transactions"("userId", "categoryId", "date" DESC);

-- CreateIndex
CREATE INDEX "transactions_accountId_idx" ON "transactions"("accountId");

-- CreateIndex
CREATE INDEX "transactions_transferToAccountId_idx" ON "transactions"("transferToAccountId");

-- CreateIndex
CREATE INDEX "transactions_recurringPaymentId_idx" ON "transactions"("recurringPaymentId");

-- CreateIndex
CREATE INDEX "debts_userId_status_idx" ON "debts"("userId", "status");

-- CreateIndex
CREATE INDEX "debts_userId_direction_status_idx" ON "debts"("userId", "direction", "status");

-- CreateIndex
CREATE INDEX "debts_userId_dueDate_idx" ON "debts"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "debt_payments_debtId_idx" ON "debt_payments"("debtId");

-- CreateIndex
CREATE INDEX "debt_payments_userId_paidAt_idx" ON "debt_payments"("userId", "paidAt" DESC);

-- CreateIndex
CREATE INDEX "loans_userId_status_idx" ON "loans"("userId", "status");

-- CreateIndex
CREATE INDEX "loans_userId_direction_status_idx" ON "loans"("userId", "direction", "status");

-- CreateIndex
CREATE INDEX "loans_userId_nextPaymentDate_idx" ON "loans"("userId", "nextPaymentDate");

-- CreateIndex
CREATE INDEX "loan_payments_loanId_status_idx" ON "loan_payments"("loanId", "status");

-- CreateIndex
CREATE INDEX "loan_payments_userId_dueDate_idx" ON "loan_payments"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "loan_payments_userId_paidAt_idx" ON "loan_payments"("userId", "paidAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "loan_payments_loanId_installmentNumber_key" ON "loan_payments"("loanId", "installmentNumber");

-- CreateIndex
CREATE INDEX "goals_userId_status_idx" ON "goals"("userId", "status");

-- CreateIndex
CREATE INDEX "goals_userId_targetDate_idx" ON "goals"("userId", "targetDate");

-- CreateIndex
CREATE INDEX "goal_contributions_goalId_idx" ON "goal_contributions"("goalId");

-- CreateIndex
CREATE INDEX "goal_contributions_userId_date_idx" ON "goal_contributions"("userId", "date" DESC);

-- CreateIndex
CREATE INDEX "recurring_payments_userId_status_idx" ON "recurring_payments"("userId", "status");

-- CreateIndex
CREATE INDEX "recurring_payments_nextOccurrence_status_idx" ON "recurring_payments"("nextOccurrence", "status");

-- CreateIndex
CREATE INDEX "recurring_payments_userId_type_status_idx" ON "recurring_payments"("userId", "type", "status");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transferToAccountId_fkey" FOREIGN KEY ("transferToAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurringPaymentId_fkey" FOREIGN KEY ("recurringPaymentId") REFERENCES "recurring_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
