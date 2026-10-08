import { BookingStatus } from "../types/api";

const STYLES: Record<BookingStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-green-100 text-green-800",
  DECLINED: "bg-red-100 text-red-800",
  CANCELLED: "bg-neutral-200 text-neutral-700",
  COMPLETED: "bg-blue-100 text-blue-800",
  PAYMENT_PENDING: "bg-purple-100 text-purple-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
};

const LABELS: Record<BookingStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  PAYMENT_PENDING: "Payment pending",
  CONFIRMED: "Confirmed",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
