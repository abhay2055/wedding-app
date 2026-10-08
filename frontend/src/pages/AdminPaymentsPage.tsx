import { useEffect, useState } from "react";
import * as paymentsApi from "../api/payments";
import { Payment, PaymentStatus } from "../types/api";
import { PaymentStatusBadge } from "../components/PaymentStatusBadge";
import { Pagination } from "../components/Pagination";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { formatDate, formatInr } from "../utils/format";

const STATUS_FILTERS: { value: PaymentStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "CAPTURED", label: "Captured" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "PARTIALLY_REFUNDED", label: "Partially refunded" },
];

const REFUNDABLE_STATUSES = new Set<PaymentStatus>(["CAPTURED", "PARTIALLY_REFUNDED"]);

function RefundForm({ payment, onDone }: { payment: Payment; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefund() {
    setIsSaving(true);
    setError(null);
    try {
      // Leaving amount blank refunds whatever remains unrefunded - see
      // payment.service.refundPayment on the backend.
      await paymentsApi.refundPayment(payment.id, amount ? Number(amount) : undefined, reason || undefined);
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      {error && <ErrorMessage message={error} />}
      <Input
        label={`Refund amount (leave blank for full ${formatInr(payment.amount)})`}
        type="number"
        min={1}
        max={payment.amount}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <Input label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button variant="danger" isLoading={isSaving} onClick={handleRefund}>
        Confirm refund
      </Button>
    </div>
  );
}

export function AdminPaymentsPage() {
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Payment[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    setError(null);
    paymentsApi
      .listPaymentsForAdmin({ status: status || undefined, page, limit: 20 })
      .then((res) => {
        setItems(res.items);
        setPagination(res.pagination);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [status, page]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRefundDone() {
    // The refund endpoint returns the newly created REFUND payment record,
    // not the original payment with its updated status - so there's no
    // single row to patch in place. Reload the list instead, which also
    // picks up the new refund record itself if it matches the current filter.
    setRefundingId(null);
    load();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-brand-800">Payments</h1>

      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="status-filter" className="text-sm font-medium text-neutral-700">Status</label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => { setStatus(e.target.value as PaymentStatus | ""); setPage(1); }}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            {STATUS_FILTERS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {isLoading ? (
        <LoadingState label="Loading payments..." />
      ) : items.length === 0 ? (
        <EmptyState title="No payments match these filters." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Booking</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((payment) => (
                  <tr key={payment.id} className="border-b border-neutral-100 align-top last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{payment.booking?.bookingNumber}</p>
                      <p className="text-xs text-neutral-500">{payment.booking?.eventNameSnapshot}</p>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{payment.customer?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-neutral-600">{payment.vendor?.businessName}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatInr(payment.amount)}</td>
                    <td className="px-4 py-3"><PaymentStatusBadge status={payment.status} /></td>
                    <td className="px-4 py-3 text-neutral-600">{formatDate(payment.paidAt ?? payment.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {REFUNDABLE_STATUSES.has(payment.status) && payment.paymentType !== "REFUND" && (
                        <>
                          {refundingId === payment.id ? (
                            <Button variant="secondary" onClick={() => setRefundingId(null)}>Cancel</Button>
                          ) : (
                            <Button variant="danger" onClick={() => setRefundingId(payment.id)}>Refund</Button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {refundingId && (
            <RefundForm payment={items.find((p) => p.id === refundingId)!} onDone={handleRefundDone} />
          )}
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
