import { Review } from "../types/api";
import { StarRating } from "./StarRating";
import { formatDate } from "../utils/format";

// Public-facing review display - only ever fed a PUBLISHED review's data.
// Never shows the reviewing customer's email/phone (the API response
// itself never includes them - see review.repository.ts's reviewInclude).
export function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="border-b border-neutral-100 py-4 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StarRating value={review.rating} size="sm" />
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
            Verified Booking
          </span>
        </div>
        <span className="text-xs text-neutral-400">{formatDate(review.createdAt)}</span>
      </div>
      {review.title && <p className="mt-2 font-medium text-neutral-900">{review.title}</p>}
      <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{review.comment}</p>
      <p className="mt-2 text-xs text-neutral-500">{review.customer?.name ?? "Anonymous"}</p>
    </div>
  );
}
