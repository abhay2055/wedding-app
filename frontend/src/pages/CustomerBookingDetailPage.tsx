import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as bookingsApi from "../api/bookings";
import * as conversationsApi from "../api/conversations";
import * as reviewsApi from "../api/reviews";
import { Booking, Review, VerifyPaymentResult } from "../types/api";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { BookingStatusBadge } from "../components/BookingStatusBadge";
import { PayAdvanceButton } from "../components/PayAdvanceButton";
import { ReviewForm } from "../components/ReviewForm";
import { ReviewStatusBadge } from "../components/ReviewStatusBadge";
import { StarRating } from "../components/StarRating";
import { LoadingState } from "../components/LoadingState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { formatDate, formatInr } from "../utils/format";

const CANCELLABLE_STATUSES = new Set(["PENDING", "ACCEPTED"]);
// The only statuses where a "Pay advance" button makes sense - PENDING (no
// attempt yet, or the previous one failed/never completed) and FAILED (the
// last attempt didn't go through). PAID and REFUNDED both mean there's
// nothing left to pay right now.
const PAYABLE_STATUSES = new Set(["PENDING", "FAILED"]);

export function CustomerBookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isMessaging, setIsMessaging] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);

  function load() {
    if (!id) return;
    setIsLoading(true);
    bookingsApi
      .getMyBooking(id)
      .then((b) => {
        setBooking(b);
        if (b.review) {
          reviewsApi.getReview(b.review.id).then(setMyReview).catch(() => undefined);
        } else {
          setMyReview(null);
        }
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCancel() {
    if (!id) return;
    setIsCancelling(true);
    setError(null);
    try {
      const updated = await bookingsApi.cancelMyBooking(id);
      setBooking(updated);
      setConfirmingCancel(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsCancelling(false);
    }
  }

  function handlePaymentSuccess(result: VerifyPaymentResult) {
    setPaymentSuccessMessage(
      result.payment.status === "CAPTURED"
        ? "Payment received - your booking is confirmed!"
        : "Payment could not be completed. Please try again.",
    );
    // The verify response's `booking` is only present when this call is
    // what actually applied the capture - reload either way so the page
    // always reflects the backend's current state, not a stale local copy.
    load();
  }

  async function handleMessageVendor() {
    if (!id) return;
    setIsMessaging(true);
    try {
      const conversation = await conversationsApi.getOrCreateConversation({ bookingId: id });
      navigate(`/dashboard/messages/${conversation.id}`);
    } finally {
      setIsMessaging(false);
    }
  }

  async function handleSubmitReview(input: { rating: number; title?: string; comment: string }) {
    if (!id) return;
    const review = await reviewsApi.createReview(id, input);
    setMyReview(review);
    setShowReviewForm(false);
    load();
  }

  if (isLoading) return <LoadingState label="Loading booking..." />;
  if (error && !booking) return <div className="mx-auto max-w-2xl px-4 py-8"><ErrorMessage message={error} /></div>;
  if (!booking) return null;

  const canCancel = CANCELLABLE_STATUSES.has(booking.status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm text-neutral-500">{booking.bookingNumber}</p>
          <h1 className="text-2xl font-semibold text-brand-800">{booking.vendor?.businessName}</h1>
        </div>
        <BookingStatusBadge status={booking.status} />
      </div>

      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Vendor</h2>
        <p className="text-neutral-900">{booking.vendor?.businessName}</p>
        <p className="text-sm text-neutral-500">{booking.vendor?.category?.name}</p>
        <p className="text-sm text-neutral-500">
          {booking.vendor?.locality ? `${booking.vendor.locality}, ` : ""}
          {booking.vendor?.city}
        </p>
        {booking.vendor?.slug && (
          <Link to={`/vendors/${booking.vendor.slug}`} className="mt-2 inline-block text-sm text-brand-700 hover:underline">
            View vendor profile →
          </Link>
        )}
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Event</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-neutral-500">Wedding</dt><dd className="text-neutral-900">{booking.eventNameSnapshot}</dd></div>
          <div><dt className="text-neutral-500">Guest count</dt><dd className="text-neutral-900">{booking.guestCount ?? "Not specified"}</dd></div>
          <div><dt className="text-neutral-500">Date</dt><dd className="text-neutral-900">{formatDate(booking.weddingDate)}</dd></div>
          {booking.eventEndDate && (
            <div><dt className="text-neutral-500">Through</dt><dd className="text-neutral-900">{formatDate(booking.eventEndDate)}</dd></div>
          )}
        </dl>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Package</h2>
        <div className="flex items-baseline justify-between">
          <p className="font-medium text-neutral-900">{booking.packageNameSnapshot ?? "Package no longer available"}</p>
          <p className="font-medium text-brand-700">{formatInr(booking.totalAmount)}</p>
        </div>
        {booking.packageDescriptionSnapshot && <p className="mt-1 text-sm text-neutral-600">{booking.packageDescriptionSnapshot}</p>}
        {booking.package?.items && booking.package.items.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {booking.package.items.map((item) => <li key={item.id}>{item.name}</li>)}
          </ul>
        )}
      </Card>

      {booking.advanceAmount !== null && booking.advanceAmount > 0 && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Advance payment</h2>
          {paymentSuccessMessage && (
            <p className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {paymentSuccessMessage}
            </p>
          )}
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-neutral-500">Advance required</dt>
              <dd className="text-neutral-900">{formatInr(booking.advanceAmount)}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Amount paid</dt>
              <dd className="text-neutral-900">{formatInr(booking.advancePaidAmount)}</dd>
            </div>
          </dl>
          {booking.status === "ACCEPTED" && PAYABLE_STATUSES.has(booking.paymentStatus) && (
            <div className="mt-4">
              <PayAdvanceButton
                bookingId={booking.id}
                amount={booking.advanceAmount}
                bookingNumber={booking.bookingNumber}
                onSuccess={handlePaymentSuccess}
              />
            </div>
          )}
          {booking.status === "CONFIRMED" && (
            <p className="mt-3 text-sm text-green-700">Advance paid - this booking is confirmed.</p>
          )}
        </Card>
      )}

      {booking.status === "COMPLETED" && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Your review</h2>
          {myReview ? (
            <div>
              <div className="flex items-center gap-2">
                <StarRating value={myReview.rating} size="sm" />
                <ReviewStatusBadge status={myReview.status} />
              </div>
              {myReview.title && <p className="mt-2 font-medium text-neutral-900">{myReview.title}</p>}
              <p className="mt-1 text-sm text-neutral-700">{myReview.comment}</p>
              {myReview.status === "PENDING" && (
                <p className="mt-2 text-xs text-neutral-500">Awaiting admin moderation before it appears publicly.</p>
              )}
            </div>
          ) : showReviewForm ? (
            <ReviewForm onSubmit={handleSubmitReview} />
          ) : (
            <Button onClick={() => setShowReviewForm(true)}>Leave a review</Button>
          )}
        </Card>
      )}

      {(booking.customerNotes || booking.vendorNotes) && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Notes</h2>
          {booking.customerNotes && (
            <div className="mb-2">
              <p className="text-xs text-neutral-500">Your notes</p>
              <p className="text-sm text-neutral-700">{booking.customerNotes}</p>
            </div>
          )}
          {booking.vendorNotes && (
            <div>
              <p className="text-xs text-neutral-500">Vendor notes</p>
              <p className="text-sm text-neutral-700">{booking.vendorNotes}</p>
            </div>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" isLoading={isMessaging} onClick={handleMessageVendor}>
          Message Vendor
        </Button>
        {canCancel && !confirmingCancel && (
          <Button variant="danger" onClick={() => setConfirmingCancel(true)}>
            Cancel booking
          </Button>
        )}
        {canCancel && confirmingCancel && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <span className="text-sm text-red-800">Cancel this booking?</span>
            <Button variant="danger" isLoading={isCancelling} onClick={handleCancel}>Confirm</Button>
            <Button variant="secondary" onClick={() => setConfirmingCancel(false)}>Keep it</Button>
          </div>
        )}
      </div>
    </div>
  );
}
