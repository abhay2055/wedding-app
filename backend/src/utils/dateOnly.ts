// Wedding and availability dates are calendar dates, not instants. Every
// date in this app is parsed and stored as UTC midnight for that specific
// calendar day, and always compared/formatted through these helpers -
// never through `new Date(str)` + local-timezone formatting - so a date
// can never silently shift by a day depending on server or client timezone.

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const MAX_BULK_AVAILABILITY_DAYS = 366;
export const MAX_SEARCH_DATE_RANGE_DAYS = 60;
// A wedding event realistically spans a handful of days at most.
export const MAX_BOOKING_DATE_RANGE_DAYS = 30;

// Returns a UTC-midnight Date for a strict "YYYY-MM-DD" string, or null if
// the string isn't in that exact format or isn't a real calendar date
// (e.g. "2027-02-30" or "2027-99-99").
export function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !DATE_ONLY_REGEX.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  // Date.UTC normalizes overflow (e.g. month 13 rolls into next year)
  // instead of throwing, so round-trip the components to catch that.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addDaysUTC(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

export function daysBetweenInclusive(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay) + 1;
}

// Every calendar date from `from` to `to`, inclusive, as UTC-midnight Dates.
export function enumerateDatesInclusive(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  let cursor = from;
  while (cursor.getTime() <= to.getTime()) {
    dates.push(cursor);
    cursor = addDaysUTC(cursor, 1);
  }
  return dates;
}
