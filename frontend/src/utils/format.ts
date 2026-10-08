import { formatDateOnlyDisplay } from "./dateOnly";

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatInr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "Price on request";
  return inrFormatter.format(amount);
}

// Wedding/availability dates are calendar dates, not instants - formatted
// in UTC (see dateOnly.ts) so this can never display a day off from what
// was actually stored, regardless of the viewer's local timezone.
export function formatDate(dateString: string | null | undefined): string {
  return formatDateOnlyDisplay(dateString);
}
