import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as bookingsApi from "../api/bookings";
import { Booking, BookingStatus } from "../types/api";
import { Card } from "../components/Card";
import { BookingStatusBadge } from "../components/BookingStatusBadge";
import { Pagination } from "../components/Pagination";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { formatDate, formatInr } from "../utils/format";

const FILTERS: { value: BookingStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending requests" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DECLINED", label: "Declined" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "COMPLETED", label: "Completed" },
];

export function VendorBookingsPage() {
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Booking[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    bookingsApi
      .listVendorBookings({ status: status || undefined, page, limit: 20 })
      .then((res) => {
        setItems(res.items);
        setPagination(res.pagination);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [status, page]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-brand-800">Bookings</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatus(f.value); setPage(1); }}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              status === f.value ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <LoadingState label="Loading bookings..." />}
      {!isLoading && error && <ErrorMessage message={error} />}
      {!isLoading && !error && items.length === 0 && (
        <EmptyState title="No bookings here yet." description="Booking requests from customers will appear here." />
      )}
      {!isLoading && !error && items.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {items.map((booking) => (
              <Link key={booking.id} to={`/vendor/bookings/${booking.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-neutral-500">{booking.bookingNumber}</p>
                      <h3 className="font-semibold text-neutral-900">{booking.customer?.name}</h3>
                      <p className="text-sm text-neutral-500">{booking.eventNameSnapshot}</p>
                    </div>
                    <BookingStatusBadge status={booking.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-neutral-600 sm:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase text-neutral-400">Package</p>
                      <p>{booking.packageNameSnapshot ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-neutral-400">Wedding date</p>
                      <p>{formatDate(booking.weddingDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-neutral-400">Guests</p>
                      <p>{booking.guestCount ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-neutral-400">Amount</p>
                      <p>{formatInr(booking.totalAmount)}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
