import { AvailabilityStatus } from "../types/api";
import { MONTH_NAMES, buildMonthGrid, todayDateOnlyString } from "../utils/dateOnly";
import { Button } from "./Button";

const STATUS_STYLES: Record<AvailabilityStatus, string> = {
  AVAILABLE: "bg-green-100 text-green-800 border-green-300",
  UNAVAILABLE: "bg-red-50 text-red-700 border-red-200",
  BLOCKED: "bg-neutral-200 text-neutral-700 border-neutral-300",
  BOOKED: "bg-purple-100 text-purple-800 border-purple-300",
};

const STATUS_SYMBOLS: Record<AvailabilityStatus, string> = {
  AVAILABLE: "✓",
  UNAVAILABLE: "✕",
  BLOCKED: "–",
  BOOKED: "●",
};

export function AvailabilityLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-neutral-600">
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-green-300 bg-green-100 text-green-800">✓</span>
        Available
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-red-200 bg-red-50 text-red-700">✕</span>
        Unavailable
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-neutral-300 bg-neutral-200 text-neutral-700">–</span>
        Blocked
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-dashed border-neutral-300 text-neutral-400">?</span>
        Not updated
      </span>
    </div>
  );
}

interface AvailabilityCalendarProps {
  year: number;
  month: number; // 0-indexed
  onMonthChange: (year: number, month: number) => void;
  statusByDate: Record<string, AvailabilityStatus>;
  onDayClick?: (dateString: string) => void;
  selectedDates?: Set<string>;
  disablePast?: boolean;
}

export function AvailabilityCalendar({
  year,
  month,
  onMonthChange,
  statusByDate,
  onDayClick,
  selectedDates,
  disablePast = false,
}: AvailabilityCalendarProps) {
  const days = buildMonthGrid(year, month);
  const today = todayDateOnlyString();

  function goToMonth(offset: number) {
    const next = new Date(Date.UTC(year, month + offset, 1));
    onMonthChange(next.getUTCFullYear(), next.getUTCMonth());
  }

  function goToToday() {
    const now = new Date();
    onMonthChange(now.getUTCFullYear(), now.getUTCMonth());
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => goToMonth(-1)} aria-label="Previous month">
            ← Prev
          </Button>
          <Button type="button" variant="secondary" onClick={() => goToMonth(1)} aria-label="Next month">
            Next →
          </Button>
          <Button type="button" variant="secondary" onClick={goToToday}>
            Today
          </Button>
        </div>
        <h3 className="font-semibold text-neutral-900">
          {MONTH_NAMES[month]} {year}
        </h3>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-neutral-500">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const status = statusByDate[day.dateString];
          const isPast = day.dateString < today;
          const isDisabled = disablePast && isPast;
          const isSelected = selectedDates?.has(day.dateString);
          const clickable = Boolean(onDayClick) && day.isCurrentMonth && !isDisabled;

          const base = "aspect-square rounded-md border text-sm flex flex-col items-center justify-center gap-0.5";
          const monthDim = !day.isCurrentMonth ? "opacity-30" : "";
          const todayRing = day.isToday ? "ring-2 ring-brand-400" : "";
          const selectedRing = isSelected ? "ring-2 ring-brand-600" : "";
          const statusClass = status ? STATUS_STYLES[status] : "bg-white text-neutral-400 border-dashed border-neutral-300";
          const cursor = clickable ? "cursor-pointer hover:opacity-80" : isDisabled ? "cursor-not-allowed" : "cursor-default";

          return (
            <button
              type="button"
              key={day.dateString}
              disabled={!clickable}
              onClick={() => onDayClick?.(day.dateString)}
              aria-label={`${day.dateString}${status ? `, ${status}` : ", availability not updated"}`}
              aria-pressed={isSelected}
              className={`${base} ${monthDim} ${todayRing} ${selectedRing} ${statusClass} ${cursor}`}
            >
              <span>{day.dayOfMonth}</span>
              <span aria-hidden="true" className="text-xs">
                {status ? STATUS_SYMBOLS[status] : "?"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
