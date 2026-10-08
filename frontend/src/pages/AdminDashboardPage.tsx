import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/Card";
import { LoadingState } from "../components/LoadingState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import * as adminApi from "../api/admin";
import { AdminDashboardStats } from "../types/api";
import { formatInr } from "../utils/format";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-xs uppercase text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
    </Card>
  );
}

const SECTIONS = [
  { to: "/admin/vendors", title: "Vendors", description: "Review, verify and activate/deactivate vendors." },
  { to: "/admin/customers", title: "Customers", description: "View customer accounts, activate/deactivate." },
  { to: "/admin/bookings", title: "Bookings", description: "Read-only oversight of every booking." },
  { to: "/admin/payments", title: "Payments", description: "View payments and issue refunds." },
  { to: "/admin/reviews", title: "Reviews", description: "Moderate pending and published reviews." },
  { to: "/admin/categories", title: "Categories", description: "Create, edit and deactivate vendor categories." },
  { to: "/admin/analytics", title: "Analytics", description: "Bookings, payments and growth over time." },
];

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminApi
      .getDashboardStats()
      .then(setStats)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold text-brand-800">Admin dashboard</h1>

      {error && <ErrorMessage message={error} />}
      {isLoading ? (
        <LoadingState label="Loading dashboard..." />
      ) : (
        stats && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Customers" value={stats.customers.total} />
            <StatCard label="Vendors" value={stats.vendors.total} />
            <StatCard label="Verified vendors" value={stats.vendors.verified} />
            <StatCard label="Pending verification" value={stats.vendors.pending} />
            <StatCard label="Total bookings" value={stats.bookings.total} />
            <StatCard label="Pending bookings" value={stats.bookings.pending} />
            <StatCard label="Confirmed bookings" value={stats.bookings.confirmed} />
            <StatCard label="Completed bookings" value={stats.bookings.completed} />
            <StatCard label="Payment volume" value={formatInr(stats.payments.totalVolume)} />
            <StatCard label="Successful payments" value={stats.payments.successful} />
            <StatCard label="Failed payments" value={stats.payments.failed} />
            <StatCard label="Pending reviews" value={stats.reviews.pending} />
          </div>
        )
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.to} to={s.to}>
            <Card className="transition-shadow hover:shadow-md">
              <h2 className="font-semibold text-neutral-900">{s.title}</h2>
              <p className="mt-1 text-sm text-neutral-500">{s.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
