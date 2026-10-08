// Wedding and availability dates are calendar dates, not instants. The
// backend always sends/accepts them anchored to UTC midnight for that
// calendar day (see backend/src/utils/dateOnly.ts) - every helper here
// works in UTC too, so a date can never silently shift by a day depending
// on the viewer's local timezone (e.g. "2027-02-15" rendering as
// "February 14" for someone west of UTC).

export function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Parses either a plain "YYYY-MM-DD" string or a full ISO instant string
// (as returned by the API for DateTime/Date fields) into a UTC-midnight Date.
export function parseDateOnlyString(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function todayDateOnlyString(): string {
  const now = new Date();
  return toDateOnlyString(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
}

export function addDaysToDateOnlyString(value: string, days: number): string {
  const date = parseDateOnlyString(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnlyString(date);
}

// Formats a date-only string for display, always in UTC so it can never
// shift by a day relative to the viewer's local timezone.
export function formatDateOnlyDisplay(value: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return "-";
  return parseDateOnlyString(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
    ...options,
  });
}

export interface CalendarDay {
  dateString: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

// A full 6-week (42-day) grid for a given month, starting on Sunday, so a
// calendar UI never has to special-case a short first/last week.
export function buildMonthGrid(year: number, month: number): CalendarDay[] {
  const today = todayDateOnlyString();
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const startWeekday = firstOfMonth.getUTCDay();
  const gridStart = new Date(Date.UTC(year, month, 1 - startWeekday));

  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(Date.UTC(gridStart.getUTCFullYear(), gridStart.getUTCMonth(), gridStart.getUTCDate() + i));
    const dateString = toDateOnlyString(date);
    days.push({
      dateString,
      dayOfMonth: date.getUTCDate(),
      isCurrentMonth: date.getUTCMonth() === month,
      isToday: dateString === today,
    });
  }
  return days;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
