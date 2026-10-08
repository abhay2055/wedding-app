import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as bookingsApi from "../api/bookings";
import * as conversationsApi from "../api/conversations";
import * as reviewsApi from "../api/reviews";
import { Booking, Review } from "../types/api";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { BookingStatusBadge } from "../components/BookingStatusBadge";
import { ReviewStatusBadge } from "../components/ReviewStatusBadge";
import { StarRating } from "../components/StarRating";
import { LoadingState } from "../components/LoadingState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { formatDate, formatInr } from "../utils/format";

type ConfirmAction = "accept" | "decline" | "cancel" | "complete" | null;

export function VendorBookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMessaging, setIsMessaging] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [review, setReview] = useState<Review | null>(null);

  function load() {
    if (!id) return;
    setIsLoading(true);
    bookingsApi
      .getVendorBooking(id)
      .then((b) => {
        setBooking(b);
        if (b.review) {
          reviewsApi.getReview(b.review.id).then(setReview).catch(() => undefined);
        } else {
          setReview(null);
        }
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirm() {
    if (!id || !confirmAction) return;
    setIsSaving(true);
    setError(null);
    try {
      let updated: Booking;
      if (confirmAction === "accept") updated = await bookingsApi.acceptVendorBooking(id, noteDraft || undefined);
      else if (confirmAction === "decline") updated = await bookingsApi.declineVendorBooking(id, noteDraft || undefined);
      else if (confirmAction === "complete") updated = await bookingsApi.completeVendorBooking(id);
      else updated = await bookingsApi.cancelVendorBooking(id, noteDraft || undefined);
      setBooking(updated);
      setConfirmAction(null);
      setNoteDraft("");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMessageCustomer() {
    if (!id) return;
    setIsMessaging(true);
    try {
      const conversation = await conversationsApi.getOrCreateConversation({ bookingId: id });
      navigate(`/vendor/messages/${conversation.id}`);
    } finally {
      setIsMessaging(false);
    }
  }

  if (isLoading) return <LoadingState label="Loading booking..." />;
  if (error && !booking) return <div className="mx-auto max-w-2xl px-4 py-8"><ErrorMessage message={error} /></div>;
  if (!booking) return null;

  const canAcceptOrDecline = booking.status === "PENDING";
  const canCancel = booking.status === "PENDING" || booking.status === "ACCEPTED";
  // The backend independently re-checks the event date has actually passed
  // (see booking.service.completeBooking) - this button is always shown for
  // a CONFIRMED booking, and a too-early attempt surfaces as an error.
  const canComplete = booking.status === "CONFIRMED";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm text-neutral-500">{booking.bookingNumber}</p>
          <h1 className="text-2xl font-semibold text-brand-800">{booking.customer?.name}</h1>
        </div>
        <BookingStatusBadge status={booking.status} />
      </div>

      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Customer</h2>
        <p className="text-neutral-900">{booking.customer?.name}</p>
        {booking.customer?.phone && <p className="text-sm text-neutral-500">{booking.customer.phone}</p>}
        {booking.customer?.email && <p className="text-sm text-neutral-500">{booking.customer.email}</p>}
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
      </Card>

      {booking.advanceAmount !== null && booking.advanceAmount > 0 && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Advance payment</h2>
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
        </Card>
      )}

      {review && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Customer review</h2>
          <div className="flex items-center gap-2">
            <StarRating value={review.rating} size="sm" />
            <ReviewStatusBadge status={review.status} />
          </div>
          {review.title && <p className="mt-2 font-medium text-neutral-900">{review.title}</p>}
          <p className="mt-1 text-sm text-neutral-700">{review.comment}</p>
        </Card>
      )}

      {(booking.customerNotes || booking.vendorNotes) && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Notes</h2>
          {booking.customerNotes && (
            <div className="mb-2">
              <p className="text-xs text-neutral-500">Customer notes</p>
              <p className="text-sm text-neutral-700">{booking.customerNotes}</p>
            </div>
          )}
          {booking.vendorNotes && (
            <div>
              <p className="text-xs text-neutral-500">Your notes</p>
              <p className="text-sm text-neutral-700">{booking.vendorNotes}</p>
            </div>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" isLoading={isMessaging} onClick={handleMessageCustomer}>
          Message Customer
        </Button>
        {canAcceptOrDecline && !confirmAction && (
          <>
            <Button onClick={() => setConfirmAction("accept")}>Accept</Button>
            <Button variant="danger" onClick={() => setConfirmAction("decline")}>Decline</Button>
          </>
        )}
        {canCancel && !confirmAction && (
          <Button variant="danger" onClick={() => setConfirmAction("cancel")}>Cancel booking</Button>
        )}
        {canComplete && !confirmAction && (
          <Button onClick={() => setConfirmAction("complete")}>Mark completed</Button>
        )}
      </div>

      {confirmAction && (
        <Card className="mt-4">
          <p className="mb-3 text-sm text-neutral-700">
            {confirmAction === "accept" && "Accept this booking? We'll re-check availability for these dates."}
            {confirmAction === "decline" && "Decline this booking request?"}
            {confirmAction === "cancel" && "Cancel this booking?"}
            {confirmAction === "complete" && "Mark this booking as completed? The customer will be able to leave a review."}
          </p>
          {confirmAction !== "complete" && (
            <Input
              label="Note (optional)"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Visible to the customer"
            />
          )}
          <div className="mt-3 flex gap-2">
            <Button
              variant={confirmAction === "accept" || confirmAction === "complete" ? "primary" : "danger"}
              isLoading={isSaving}
              onClick={handleConfirm}
            >
              Confirm
            </Button>
            <Button variant="secondary" onClick={() => { setConfirmAction(null); setNoteDraft(""); }}>
              Back
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
