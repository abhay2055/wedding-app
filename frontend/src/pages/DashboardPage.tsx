import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import * as userApi from "../api/user";
import * as eventsApi from "../api/events";
import * as bookingsApi from "../api/bookings";
import { WeddingEvent } from "../types/api";
import { formatDate, formatInr } from "../utils/format";

function weddingDateQuery(event: WeddingEvent): string {
  const weddingDate = event.weddingDate.slice(0, 10);
  const endDate = event.endDate?.slice(0, 10);
  if (endDate && endDate !== weddingDate) {
    return `/vendors?availableFrom=${weddingDate}&availableTo=${endDate}`;
  }
  return `/vendors?availableOn=${weddingDate}`;
}

function WeddingOverviewCard() {
  const [events, setEvents] = useState<WeddingEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    eventsApi
      .listMyEvents()
      .then(setEvents)
      .catch((err) => setError(extractErrorMessage(err)));
  }, []);

  if (error) return <ErrorMessage message={error} />;
  if (events === null) return <LoadingState label="Loading your wedding..." />;

  if (events.length === 0) {
    return (
      <EmptyState
        title="You haven't created your wedding yet."
        description="Tell us the details so we can help you find the right vendors."
        action={
          <Link to="/wedding/new">
            <Button>Create Your Wedding</Button>
          </Link>
        }
      />
    );
  }

  const event = events[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">{event.name}</h3>
          <p className="text-sm text-neutral-500">{event.city}</p>
        </div>
        <Link to={`/wedding/${event.id}/edit`}>
          <Button variant="secondary">Edit wedding</Button>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-neutral-500">Wedding date</p>
          <p className="font-medium text-neutral-900">{formatDate(event.weddingDate)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-neutral-500">Guests</p>
          <p className="font-medium text-neutral-900">{event.guestCount ?? "Not set"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-neutral-500">Budget</p>
          <p className="font-medium text-neutral-900">
            {event.budgetMin || event.budgetMax
              ? `${formatInr(event.budgetMin)} - ${formatInr(event.budgetMax)}`
              : "Not set"}
          </p>
        </div>
      </div>
      {event.interestedCategories.length > 0 && (
        <div>
          <p className="mb-1 text-xs uppercase text-neutral-500">Interested in</p>
          <div className="flex flex-wrap gap-2">
            {event.interestedCategories.map((c) => (
              <span key={c.id} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs text-brand-700">
                {c.category.name}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3 border-t border-neutral-100 pt-4">
        <Link to="/vendors">
          <Button variant="secondary">View vendors</Button>
        </Link>
        <Link to="/vendors">
          <Button variant="secondary">Browse categories</Button>
        </Link>
        <Link to="/favorites">
          <Button variant="secondary">Saved vendors</Button>
        </Link>
        <Link to="/dashboard/bookings">
          <Button variant="secondary">My bookings</Button>
        </Link>
        <Link to={weddingDateQuery(event)}>
          <Button>Show available vendors</Button>
        </Link>
      </div>
    </div>
  );
}

function BookingsSummaryCard() {
  const [counts, setCounts] = useState<{ pending: number; accepted: number } | null>(null);

  useEffect(() => {
    Promise.all([
      bookingsApi.listMyBookings({ status: "PENDING", limit: 1 }),
      bookingsApi.listMyBookings({ status: "ACCEPTED", limit: 1 }),
    ])
      .then(([pending, accepted]) => setCounts({ pending: pending.pagination.total, accepted: accepted.pagination.total }))
      .catch(() => setCounts(null));
  }, []);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">My bookings</h2>
          <p className="text-sm text-neutral-500">
            {counts === null ? "-" : `${counts.pending} pending, ${counts.accepted} accepted`}
          </p>
        </div>
        <Link to="/dashboard/bookings">
          <Button variant="secondary">View all</Button>
        </Link>
      </div>
    </Card>
  );
}

function ProfileCard() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [savedUser, setSavedUser] = useState(user);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSaving(true);
    try {
      const updated = await userApi.updateMe({ name, phone: phone || undefined });
      setSavedUser(updated);
      setSuccess(true);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <ErrorMessage message={error} />}
      {success && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Profile updated.
        </p>
      )}
      <Input label="Email" value={savedUser?.email ?? ""} disabled />
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="Phone" value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} />
      <Input label="Role" value={savedUser?.role ?? ""} disabled />
      <Button type="submit" isLoading={isSaving}>
        Save changes
      </Button>
    </form>
  );
}

export function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;
  if (user.role === "VENDOR") return <Navigate to="/vendor" replace />;
  if (user.role === "ADMIN") return <Navigate to="/admin" replace />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold text-brand-800">Welcome, {user.name}</h1>

      <Card>
        <h2 className="mb-4 text-lg font-medium">My wedding</h2>
        <WeddingOverviewCard />
      </Card>

      <BookingsSummaryCard />

      <Card>
        <h2 className="mb-4 text-lg font-medium">Your profile</h2>
        <ProfileCard />
      </Card>
    </div>
  );
}
