import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as reviewsApi from "../api/reviews";
import { Review } from "../types/api";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { ReviewForm } from "../components/ReviewForm";
import { ReviewStatusBadge } from "../components/ReviewStatusBadge";
import { StarRating } from "../components/StarRating";
import { Pagination } from "../components/Pagination";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { formatDate } from "../utils/format";

const EDITABLE_STATUSES = new Set(["PENDING", "PUBLISHED"]);

export function CustomerReviewsPage() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Review[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    setError(null);
    reviewsApi
      .listMyReviews({ page, limit: 20 })
      .then((res) => {
        setItems(res.items);
        setPagination(res.pagination);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpdate(review: Review, input: { rating: number; title?: string; comment: string }) {
    const updated = await reviewsApi.updateReview(review.id, input);
    setItems((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setEditingId(null);
  }

  async function handleDelete(review: Review) {
    setBusyId(review.id);
    try {
      await reviewsApi.deleteReview(review.id);
      setItems((prev) => prev.filter((r) => r.id !== review.id));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-brand-800">My reviews</h1>

      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}

      {isLoading ? (
        <LoadingState label="Loading your reviews..." />
      ) : items.length === 0 ? (
        <EmptyState
          title="You haven't left any reviews yet."
          description="Once a booking is marked completed, you can leave a review from its booking detail page."
          action={<Link to="/dashboard/bookings" className="text-brand-700 hover:underline">View bookings</Link>}
        />
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {items.map((review) => (
              <Card key={review.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-neutral-900">{review.vendor?.businessName}</p>
                    <p className="text-xs text-neutral-500">{review.booking?.bookingNumber}</p>
                  </div>
                  <ReviewStatusBadge status={review.status} />
                </div>

                {editingId === review.id ? (
                  <div className="mt-3">
                    <ReviewForm initial={review} submitLabel="Save changes" onSubmit={(input) => handleUpdate(review, input)} />
                    <Button variant="secondary" className="mt-2" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <>
                    <div className="mt-2 flex items-center gap-2">
                      <StarRating value={review.rating} size="sm" />
                      <span className="text-xs text-neutral-400">{formatDate(review.createdAt)}</span>
                    </div>
                    {review.title && <p className="mt-2 font-medium text-neutral-900">{review.title}</p>}
                    <p className="mt-1 text-sm text-neutral-700">{review.comment}</p>
                    {review.status === "PENDING" && (
                      <p className="mt-2 text-xs text-neutral-500">Awaiting admin moderation.</p>
                    )}
                    <div className="mt-3 flex gap-2">
                      {EDITABLE_STATUSES.has(review.status) && (
                        <Button variant="secondary" onClick={() => setEditingId(review.id)}>Edit</Button>
                      )}
                      <Button variant="danger" isLoading={busyId === review.id} onClick={() => handleDelete(review)}>
                        Delete
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            ))}
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
