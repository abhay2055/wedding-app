import { useEffect, useState } from "react";
import * as availabilityApi from "../api/availability";
import { AvailabilityStatus, VendorAvailabilityDay, VendorSettableAvailabilityStatus } from "../types/api";
import { AvailabilityCalendar, AvailabilityLegend } from "./AvailabilityCalendar";
import { Card } from "./Card";
import { Button } from "./Button";
import { LoadingState } from "./LoadingState";
import { ErrorMessage, extractErrorMessage } from "./ErrorMessage";
import { buildMonthGrid, formatDateOnlyDisplay, todayDateOnlyString } from "../utils/dateOnly";

const STATUS_LABELS: Record<VendorSettableAvailabilityStatus, string> = {
  AVAILABLE: "Available",
  UNAVAILABLE: "Unavailable",
  BLOCKED: "Blocked",
};

type Mode = "single" | "range";

export function VendorAvailabilityManager() {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth());
  const [records, setRecords] = useState<VendorAvailabilityDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("single");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [armedBulkStatus, setArmedBulkStatus] = useState<VendorSettableAvailabilityStatus | null>(null);

  const [noteDraft, setNoteDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function load() {
    setIsLoading(true);
    setError(null);
    const grid = buildMonthGrid(year, month);
    const from = grid[0].dateString;
    const to = grid[grid.length - 1].dateString;
    availabilityApi
      .listMyAvailability(from, to)
      .then(setRecords)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusByDate: Record<string, AvailabilityStatus> = {};
  const recordByDate: Record<string, VendorAvailabilityDay> = {};
  for (const r of records) {
    statusByDate[r.date.slice(0, 10)] = r.status;
    recordByDate[r.date.slice(0, 10)] = r;
  }

  function resetSelection() {
    setSelectedDate(null);
    setRangeStart(null);
    setRangeEnd(null);
    setArmedBulkStatus(null);
    setNoteDraft("");
  }

  function handleDayClick(dateString: string) {
    setError(null);
    if (mode === "single") {
      setSelectedDate(dateString);
      setNoteDraft(recordByDate[dateString]?.note ?? "");
      return;
    }
    // Range mode: first click sets the start, second sets the end
    // (order-normalized so clicking backwards still works).
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(dateString);
      setRangeEnd(null);
      setArmedBulkStatus(null);
      return;
    }
    const [start, end] = dateString < rangeStart ? [dateString, rangeStart] : [rangeStart, dateString];
    setRangeStart(start);
    setRangeEnd(end);
  }

  async function handleSetSingle(status: VendorSettableAvailabilityStatus) {
    if (!selectedDate) return;
    setIsSaving(true);
    setError(null);
    try {
      await availabilityApi.setAvailability(selectedDate, status, noteDraft || undefined);
      load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClearSingle() {
    if (!selectedDate) return;
    const record = recordByDate[selectedDate];
    if (!record) {
      resetSelection();
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await availabilityApi.deleteAvailability(record.id);
      resetSelection();
      load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  function selectedDatesInRange(): Set<string> {
    if (!rangeStart) return new Set();
    const grid = buildMonthGrid(year, month);
    const end = rangeEnd ?? rangeStart;
    return new Set(grid.map((d) => d.dateString).filter((d) => d >= rangeStart && d <= end));
  }

  const rangeDates = selectedDatesInRange();

  async function handleConfirmBulk() {
    if (!rangeStart || !rangeEnd || !armedBulkStatus) return;
    setIsSaving(true);
    setError(null);
    try {
      await availabilityApi.bulkSetAvailability(rangeStart, rangeEnd, armedBulkStatus);
      resetSelection();
      load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  const today = todayDateOnlyString();
  const selectedIsPast = selectedDate !== null && selectedDate < today;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <AvailabilityLegend />
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "single" ? "primary" : "secondary"}
              onClick={() => { setMode("single"); resetSelection(); }}
            >
              Single date
            </Button>
            <Button
              type="button"
              variant={mode === "range" ? "primary" : "secondary"}
              onClick={() => { setMode("range"); resetSelection(); }}
            >
              Select a range
            </Button>
          </div>
        </div>

        {error && <div className="mb-3"><ErrorMessage message={error} /></div>}

        {isLoading ? (
          <LoadingState label="Loading your calendar..." />
        ) : (
          <AvailabilityCalendar
            year={year}
            month={month}
            onMonthChange={(y, m) => { setYear(y); setMonth(m); resetSelection(); }}
            statusByDate={statusByDate}
            onDayClick={handleDayClick}
            selectedDates={mode === "single" ? (selectedDate ? new Set([selectedDate]) : undefined) : rangeDates}
            disablePast
          />
        )}
      </Card>

      {mode === "single" && selectedDate && (
        <Card>
          <h4 className="mb-3 font-medium">{formatDateOnlyDisplay(selectedDate)}</h4>
          {selectedIsPast ? (
            <p className="text-sm text-neutral-500">Past dates can&apos;t be edited.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(STATUS_LABELS) as VendorSettableAvailabilityStatus[]).map((status) => (
                  <Button key={status} variant="secondary" isLoading={isSaving} onClick={() => handleSetSingle(status)}>
                    Mark {STATUS_LABELS[status]}
                  </Button>
                ))}
              </div>
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Optional note (private - only you and admins see this)"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              {recordByDate[selectedDate] && (
                <Button variant="danger" isLoading={isSaving} onClick={handleClearSingle}>
                  Clear (mark as not updated)
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {mode === "range" && rangeStart && rangeEnd && (
        <Card>
          <p className="mb-3 text-sm text-neutral-700">
            {rangeDates.size} date{rangeDates.size === 1 ? "" : "s"} selected: {formatDateOnlyDisplay(rangeStart)} –{" "}
            {formatDateOnlyDisplay(rangeEnd)}
          </p>
          {!armedBulkStatus ? (
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABELS) as VendorSettableAvailabilityStatus[]).map((status) => (
                <Button key={status} variant="secondary" onClick={() => setArmedBulkStatus(status)}>
                  Mark {STATUS_LABELS[status]}
                </Button>
              ))}
              <Button variant="secondary" onClick={resetSelection}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">
                Mark {rangeDates.size} date{rangeDates.size === 1 ? "" : "s"} as {STATUS_LABELS[armedBulkStatus]}?
              </p>
              <Button isLoading={isSaving} onClick={handleConfirmBulk}>
                Confirm
              </Button>
              <Button variant="secondary" onClick={() => setArmedBulkStatus(null)}>
                Cancel
              </Button>
            </div>
          )}
        </Card>
      )}

      {mode === "range" && rangeStart && !rangeEnd && (
        <p className="text-sm text-neutral-500">Now click an end date to complete the range.</p>
      )}
    </div>
  );
}
