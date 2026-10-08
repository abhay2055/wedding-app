import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import * as vendorApi from "../api/vendor";
import * as eventsApi from "../api/events";
import * as bookingsApi from "../api/bookings";
import { VendorPublicProfile, WeddingEvent } from "../types/api";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { formatDateOnlyDisplay, todayDateOnlyString } from "../utils/dateOnly";
import { formatInr } from "../utils/format";

export function BookingRequestPage() {
  const [searchParams] = useSearchParams();
  const vendorId = searchParams.get("vendorId") ?? "";
  const navigate = useNavigate();

  const [vendor, setVendor] = useState<VendorPublicProfile | null>(null);
  const [events, setEvents] = useState<WeddingEvent[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [eventId, setEventId] = useState(searchParams.get("eventId") ?? "");
  const [packageId, setPackageId] = useState(searchParams.get("packageId") ?? "");
  const [weddingDate, setWeddingDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!vendorId) {
      setLoadError("No vendor specified.");
      setIsLoading(false);
      return;
    }
    Promise.all([vendorApi.getVendorProfileById(vendorId), eventsApi.listMyEvents()])
      .then(([vendorData, eventsData]) => {
        setVendor(vendorData);
        setEvents(eventsData);
        const firstEvent = eventsData[0];
        if (firstEvent) {
          setEventId((prev) => prev || firstEvent.id);
          setWeddingDate((prev) => prev || firstEvent.weddingDate.slice(0, 10));
          if (firstEvent.endDate) setEventEndDate((prev) => prev || firstEvent.endDate!.slice(0, 10));
          setGuestCount((prev) => prev || (firstEvent.guestCount ? String(firstEvent.guestCount) : ""));
        }
        if (!packageId && vendorData.packages[0]) setPackageId(vendorData.packages[0].id);
      })
      .catch((err) => setLoadError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const selectedPackage = vendor?.packages.find((p) => p.id === packageId) ?? null;
  const selectedEvent = events?.find((e) => e.id === eventId) ?? null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const booking = await bookingsApi.createBooking({
        vendorId,
        eventId,
        packageId,
        weddingDate,
        eventEndDate: eventEndDate || undefined,
        guestCount: guestCount ? Number(guestCount) : undefined,
        customerNotes: customerNotes || undefined,
      });
      navigate(`/dashboard/bookings/${booking.id}`);
    } catch (err) {
      setSubmitError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <LoadingState label="Loading booking details..." />;
  if (loadError) return <div className="mx-auto max-w-xl px-4 py-8"><ErrorMessage message={loadError} /></div>;
  if (!vendor) return null;

  if (!events || events.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <EmptyState
          title="You need a wedding/event before requesting a booking."
          description="Create your wedding first, then come back to request this vendor."
          action={
            <Link to="/wedding/new">
              <Button>Create Your Wedding</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
      <div>
        <p className="text-sm text-neutral-500">Request booking with</p>
        <h1 className="text-2xl font-semibold text-brand-800">{vendor.businessName}</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {submitError && <ErrorMessage message={submitError} />}

          <div className="flex flex-col gap-1">
            <label htmlFor="booking-event" className="text-sm font-medium text-neutral-700">Wedding/event</label>
            <select
              id="booking-event"
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value);
                const ev = events.find((x) => x.id === e.target.value);
                if (ev) {
                  setWeddingDate(ev.weddingDate.slice(0, 10));
                  setEventEndDate(ev.endDate ? ev.endDate.slice(0, 10) : "");
                  if (ev.guestCount) setGuestCount(String(ev.guestCount));
                }
              }}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              required
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({formatDateOnlyDisplay(ev.weddingDate)})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="booking-package" className="text-sm font-medium text-neutral-700">Package</label>
            <select
              id="booking-package"
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              required
            >
              {vendor.packages.length === 0 && <option value="">No packages available</option>}
              {vendor.packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} — {formatInr(pkg.price)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Wedding date"
              type="date"
              min={todayDateOnlyString()}
              value={weddingDate}
              onChange={(e) => setWeddingDate(e.target.value)}
              required
            />
            <Input
              label="End date (optional)"
              type="date"
              min={weddingDate || todayDateOnlyString()}
              value={eventEndDate}
              onChange={(e) => setEventEndDate(e.target.value)}
            />
          </div>

          <Input label="Guest count (optional)" type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} />
          <Input label="Notes for the vendor (optional)" value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} />

          {selectedPackage && selectedEvent && (
            <Card className="bg-neutral-50">
              <h3 className="mb-2 text-sm font-semibold text-neutral-700">Booking summary</h3>
              <dl className="space-y-1 text-sm text-neutral-700">
                <div className="flex justify-between"><dt>Wedding</dt><dd>{selectedEvent.name}</dd></div>
                <div className="flex justify-between"><dt>Vendor</dt><dd>{vendor.businessName}</dd></div>
                <div className="flex justify-between"><dt>Package</dt><dd>{selectedPackage.name}</dd></div>
                <div className="flex justify-between"><dt>Date</dt><dd>{weddingDate ? formatDateOnlyDisplay(weddingDate) : "-"}</dd></div>
                {eventEndDate && <div className="flex justify-between"><dt>Through</dt><dd>{formatDateOnlyDisplay(eventEndDate)}</dd></div>}
                <div className="flex justify-between font-medium"><dt>Price</dt><dd>{formatInr(selectedPackage.price)}</dd></div>
              </dl>
            </Card>
          )}

          <p className="text-xs text-neutral-500">
            This sends a request to the vendor - it doesn&apos;t confirm the booking until they accept. We&apos;ll
            re-check their availability when you submit.
          </p>

          <Button type="submit" isLoading={isSubmitting} disabled={!packageId}>
            Request Booking
          </Button>
        </form>
      </Card>
    </div>
  );
}
