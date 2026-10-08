import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as paymentsApi from "../api/payments";
import { Payment, PaymentStatus } from "../types/api";
import { Card } from "../components/Card";
import { PaymentStatusBadge } from "../components/PaymentStatusBadge";
import { Pagination } from "../components/Pagination";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { formatDate, formatInr } from "../utils/format";

const FILTERS: { value: PaymentStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "CAPTURED", label: "Paid" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
];

// Read-only - a vendor sees what customers have paid on their bookings,
// never any provider secret (see Payment type - providerSignature is never
// sent to the frontend at all).
export function VendorPaymentsPage() {
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Payment[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    paymentsApi
      .listVendorPayments({ status: status || undefined, page, limit: 20 })
      .then((res) => {
        setItems(res.items);
        setPagination(res.pagination);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [status, page]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-brand-800">Payments</h1>

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

      {isLoading && <LoadingState label="Loading payments..." />}
      {!isLoading && error && <ErrorMessage message={error} />}
      {!isLoading && !error && items.length === 0 && <EmptyState title="No payments yet." />}
      {!isLoading && !error && items.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {items.map((payment) => (
              <Card key={payment.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-neutral-500">{payment.booking?.bookingNumber}</p>
                    <h3 className="font-semibold text-neutral-900">{payment.booking?.eventNameSnapshot}</h3>
                  </div>
                  <PaymentStatusBadge status={payment.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-neutral-600 sm:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase text-neutral-400">Amount</p>
                    <p>{formatInr(payment.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-neutral-400">Type</p>
                    <p>{payment.paymentType}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-neutral-400">Date</p>
                    <p>{formatDate(payment.paidAt ?? payment.createdAt)}</p>
                  </div>
                  {payment.booking && (
                    <div>
                      <p className="text-xs uppercase text-neutral-400">Booking</p>
                      <Link to={`/vendor/bookings/${payment.booking.id}`} className="text-brand-700 hover:underline">
                        View
                      </Link>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
