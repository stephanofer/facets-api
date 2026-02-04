/**
 * Feature codes for subscription plan limits
 *
 * These codes are used throughout the application to check feature access.
 * They map to the featureCode column in the PlanFeature table.
 *
 * USAGE:
 * - Use FEATURES.* for @RequireFeature decorator
 * - Use FEATURES.* in FeatureGuard checks
 * - All feature codes must match those in prisma/seed.ts
 */
export const FEATURES = {
  // ==========================================================================
  // RESOURCE Features (count from actual tables - deletable)
  // ==========================================================================

  /** Bank/financial accounts limit */
  ACCOUNTS: 'accounts',

  /** Financial goals limit */
  GOALS: 'goals',

  /** Debt tracking limit */
  DEBTS: 'debts',

  /** Loan management limit */
  LOANS: 'loans',

  /** Custom categories limit */
  CUSTOM_CATEGORIES: 'custom_categories',

  /** Recurring payments limit */
  RECURRING_PAYMENTS: 'recurring_payments',

  // ==========================================================================
  // CONSUMABLE Features (count from UsageRecord - period-based, not restored on delete)
  // ==========================================================================

  /** Transactions per month limit */
  TRANSACTIONS_PER_MONTH: 'transactions_per_month',

  // ==========================================================================
  // BOOLEAN Features (on/off toggles)
  // ==========================================================================

  /** Access to advanced reports */
  ADVANCED_REPORTS: 'advanced_reports',

  /** Ability to export data (CSV, PDF, Excel) */
  EXPORT_DATA: 'export_data',

  /** Multi-currency support */
  MULTI_CURRENCY: 'multi_currency',

  /** Budget alerts and notifications */
  BUDGET_ALERTS: 'budget_alerts',

  /** AI-powered financial insights */
  AI_INSIGHTS: 'ai_insights',
} as const;

/**
 * Type for feature code values
 */
export type FeatureCode = (typeof FEATURES)[keyof typeof FEATURES];

/**
 * Plan codes for the subscription system
 */
export const PLAN_CODES = {
  FREE: 'free',
  PRO: 'pro',
  PREMIUM: 'premium',
} as const;

export type PlanCode = (typeof PLAN_CODES)[keyof typeof PLAN_CODES];
