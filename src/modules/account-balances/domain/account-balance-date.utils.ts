export function normalizeBalanceDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function formatBalanceDate(date: Date): string {
  return normalizeBalanceDate(date).toISOString().slice(0, 10);
}

export function addBalanceDays(date: Date, days: number): Date {
  const result = normalizeBalanceDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function minBalanceDate(left: Date, right: Date): Date {
  return normalizeBalanceDate(left).getTime() <=
    normalizeBalanceDate(right).getTime()
    ? normalizeBalanceDate(left)
    : normalizeBalanceDate(right);
}

export function maxBalanceDate(
  dates: Array<Date | null | undefined>,
): Date | null {
  const normalizedDates = dates
    .filter((date): date is Date => date instanceof Date)
    .map((date) => normalizeBalanceDate(date));

  if (normalizedDates.length === 0) {
    return null;
  }

  return normalizedDates.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest,
  );
}
