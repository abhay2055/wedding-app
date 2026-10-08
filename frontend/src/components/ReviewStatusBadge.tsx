import { ReviewStatus } from "../types/api";

const STYLES: Record<ReviewStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PUBLISHED: "bg-green-100 text-green-800",
  HIDDEN: "bg-neutral-200 text-neutral-700",
  REJECTED: "bg-red-100 text-red-800",
};

const LABELS: Record<ReviewStatus, string> = {
  PENDING: "Pending review",
  PUBLISHED: "Published",
  HIDDEN: "Hidden",
  REJECTED: "Rejected",
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
