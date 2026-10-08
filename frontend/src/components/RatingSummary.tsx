import { VendorReviewSummary } from "../types/api";
import { StarRating } from "./StarRating";

// "5★ - 100 / 4★ - 18 / ..." distribution bar, per the Phase 6 spec's
// worked example on the public vendor profile.
export function RatingSummary({ summary }: { summary: VendorReviewSummary }) {
  const maxCount = Math.max(1, ...Object.values(summary.distribution));

  if (summary.reviewCount === 0) {
    return <p className="text-sm text-neutral-500">No reviews yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="flex flex-shrink-0 flex-col items-start gap-1">
        <p className="text-3xl font-semibold text-neutral-900">{summary.averageRating.toFixed(1)}</p>
        <StarRating value={summary.averageRating} size="sm" />
        <p className="text-sm text-neutral-500">{summary.reviewCount} review{summary.reviewCount === 1 ? "" : "s"}</p>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = summary.distribution[star] ?? 0;
          const pct = (count / maxCount) * 100;
          return (
            <div key={star} className="flex items-center gap-2 text-xs text-neutral-600">
              <span className="w-8 flex-shrink-0">{star} ★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-6 flex-shrink-0 text-right">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
