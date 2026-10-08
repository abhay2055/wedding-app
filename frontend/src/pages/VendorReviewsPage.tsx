import { useEffect, useState } from "react";
import * as reviewsApi from "../api/reviews";
import { Review } from "../types/api";
import { Card } from "../components/Card";
import { ReviewStatusBadge } from "../components/ReviewStatusBadge";
import { StarRating } from "../components/StarRating";
import { Pagination } from "../components/Pagination";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { formatDate } from "../utils/format";

// Read-only - a vendor sees what customers have said about them, but
// moderation (publish/hide/reject) is admin-only (see AdminReviewsPage).
export function VendorReviewsPage() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Review[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    reviewsApi
      .listMyVendorReviews({ page, limit: 20 })
      .then((res) => {
        setItems(res.items);
        setPagination(res.pagination);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [page]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-brand-800">Reviews</h1>

      {error && <ErrorMessage message={error} />}

      {isLoading ? (
        <LoadingState label="Loading reviews..." />
      ) : items.length === 0 ? (
        <EmptyState title="No reviews yet." description="Reviews from customers will appear here once submitted." />
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {items.map((review) => (
              <Card key={review.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-neutral-900">{review.customer?.name ?? "Customer"}</p>
                    <p className="text-xs text-neutral-500">{review.booking?.bookingNumber}</p>
                  </div>
                  <ReviewStatusBadge status={review.status} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <StarRating value={review.rating} size="sm" />
                  <span className="text-xs text-neutral-400">{formatDate(review.createdAt)}</span>
                </div>
                {review.title && <p className="mt-2 font-medium text-neutral-900">{review.title}</p>}
                <p className="mt-1 text-sm text-neutral-700">{review.comment}</p>
              </Card>
            ))}
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
