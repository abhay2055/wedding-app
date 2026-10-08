import { VerificationStatus } from "../types/api";

const STYLES: Record<VerificationStatus, string> = {
  VERIFIED: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-800",
};

const LABELS: Record<VerificationStatus, string> = {
  VERIFIED: "Verified",
  PENDING: "Verification pending",
  REJECTED: "Verification rejected",
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
