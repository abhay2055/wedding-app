import { useEffect, useState } from "react";
import * as bookingsApi from "../api/bookings";
import { Booking, BookingStatus } from "../types/api";
import { BookingStatusBadge } from "../components/BookingStatusBadge";
import { Pagination } from "../components/Pagination";
import { Input } from "../components/Input";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { formatDate, formatInr } from "../utils/format";

const STATUS_FILTERS: { value: BookingStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DECLINED", label: "Declined" },
  { value: "CANCELLED", label: "Cancelled" },
];

// Read-only, per the Phase 6 spec ("keep this primarily read-only... do
// not let Admin casually modify booking financial state") - the admin
// booking API itself has no write endpoints besides read-only listing.
export function AdminBookingsPage() {
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Booking[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    setError(null);
    bookingsApi
      .listBookingsForAdmin({ status: status || undefined, from: from || undefined, to: to || undefined, page, limit: 20 })
      .then((res) => {
        setItems(res.items);
        setPagination(res.pagination);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [status, page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-brand-800">Bookings</h1>

      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="status-filter" className="text-sm font-medium text-neutral-700">Status</label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => { setStatus(e.target.value as BookingStatus | ""); setPage(1); }}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            {STATUS_FILTERS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <Input label="Wedding date from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="Wedding date to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button
          onClick={() => { setPage(1); load(); }}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Apply
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {isLoading ? (
        <LoadingState label="Loading bookings..." />
      ) : items.length === 0 ? (
        <EmptyState title="No bookings match these filters." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Booking</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Wedding date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((booking) => (
                  <tr key={booking.id} className="border-b border-neutral-100 align-top last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{booking.bookingNumber}</p>
                      <p className="text-xs text-neutral-500">{formatDate(booking.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{booking.customer?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-neutral-600">{booking.vendor?.businessName ?? "-"}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatDate(booking.weddingDate)}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatInr(booking.totalAmount)}</td>
                    <td className="px-4 py-3 text-neutral-600">{booking.paymentStatus}</td>
                    <td className="px-4 py-3"><BookingStatusBadge status={booking.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
