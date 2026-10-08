import { useEffect, useState } from "react";
import * as reviewsApi from "../api/reviews";
import { Review, ReviewStatus } from "../types/api";
import { ReviewStatusBadge } from "../components/ReviewStatusBadge";
import { StarRating } from "../components/StarRating";
import { Pagination } from "../components/Pagination";
import { Button } from "../components/Button";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { formatDate } from "../utils/format";

const STATUS_FILTERS: { value: ReviewStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "PUBLISHED", label: "Published" },
  { value: "HIDDEN", label: "Hidden" },
  { value: "REJECTED", label: "Rejected" },
];

export function AdminReviewsPage() {
  const [status, setStatus] = useState<ReviewStatus | "">("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Review[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    setError(null);
    reviewsApi
      .listReviewsForAdmin({ status: status || undefined, page, limit: 20 })
      .then((res) => {
        setItems(res.items);
        setPagination(res.pagination);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [status, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleModerate(review: Review, next: ReviewStatus) {
    setBusyId(review.id);
    try {
      const updated = await reviewsApi.moderateReview(review.id, next);
      setItems((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-brand-800">Reviews</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
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

      {error && <ErrorMessage message={error} />}

      {isLoading ? (
        <LoadingState label="Loading reviews..." />
      ) : items.length === 0 ? (
        <EmptyState title="No reviews match these filters." />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {items.map((review) => (
              <div key={review.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-neutral-500">{review.booking?.bookingNumber}</p>
                    <p className="font-medium text-neutral-900">{review.vendor?.businessName}</p>
                    <p className="text-xs text-neutral-500">by {review.customer?.name}</p>
                  </div>
                  <ReviewStatusBadge status={review.status} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <StarRating value={review.rating} size="sm" />
                  <span className="text-xs text-neutral-400">{formatDate(review.createdAt)}</span>
                </div>
                {review.title && <p className="mt-2 font-medium text-neutral-900">{review.title}</p>}
                <p className="mt-1 text-sm text-neutral-700">{review.comment}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {review.status !== "PUBLISHED" && (
                    <Button isLoading={busyId === review.id} onClick={() => handleModerate(review, "PUBLISHED")}>
                      Publish
                    </Button>
                  )}
                  {review.status === "PUBLISHED" && (
                    <Button variant="secondary" isLoading={busyId === review.id} onClick={() => handleModerate(review, "HIDDEN")}>
                      Hide
                    </Button>
                  )}
                  {review.status !== "REJECTED" && (
                    <Button variant="danger" isLoading={busyId === review.id} onClick={() => handleModerate(review, "REJECTED")}>
                      Reject
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
