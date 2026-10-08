import { PaymentStatus } from "../types/api";

const STYLES: Record<PaymentStatus, string> = {
  CREATED: "bg-neutral-100 text-neutral-700",
  PENDING: "bg-amber-100 text-amber-800",
  AUTHORIZED: "bg-amber-100 text-amber-800",
  CAPTURED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-neutral-200 text-neutral-700",
  REFUNDED: "bg-purple-100 text-purple-800",
  PARTIALLY_REFUNDED: "bg-purple-100 text-purple-800",
};

const LABELS: Record<PaymentStatus, string> = {
  CREATED: "Created",
  PENDING: "Pending",
  AUTHORIZED: "Authorized",
  CAPTURED: "Paid",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
