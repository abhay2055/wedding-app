import { useEffect, useState } from "react";
import * as adminApi from "../api/admin";
import { AdminAnalytics, AdminAnalyticsBucket, AdminAnalyticsRange } from "../types/api";
import { Card } from "../components/Card";
import { LoadingState } from "../components/LoadingState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { formatDate, formatInr } from "../utils/format";

const RANGE_OPTIONS: { value: AdminAnalyticsRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "1y", label: "This year" },
];

function BucketBarChart({ buckets, formatValue }: { buckets: AdminAnalyticsBucket[]; formatValue?: (v: number) => string }) {
  if (buckets.length === 0) return <p className="text-sm text-neutral-500">No data for this range yet.</p>;
  const max = Math.max(1, ...buckets.map((b) => b.value));
  return (
    <div className="flex flex-col gap-1.5">
      {buckets.map((b) => (
        <div key={b.bucket} className="flex items-center gap-2 text-xs text-neutral-600">
          <span className="w-20 flex-shrink-0">{formatDate(b.bucket)}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(b.value / max) * 100}%` }} />
          </div>
          <span className="w-20 flex-shrink-0 text-right">{formatValue ? formatValue(b.value) : b.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AdminAnalyticsPage() {
  const [range, setRange] = useState<AdminAnalyticsRange>("30d");
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    adminApi
      .getAnalytics(range)
      .then(setData)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [range]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand-800">Analytics</h1>
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setRange(o.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                range === o.value ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorMessage message={error} />}
      {isLoading ? (
        <LoadingState label="Loading analytics..." />
      ) : (
        data && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card>
                <p className="text-xs uppercase text-neutral-500">Booking conversion</p>
                <p className="mt-1 text-lg font-semibold text-neutral-900">
                  {(data.bookingConversionRate * 100).toFixed(1)}%
                </p>
              </Card>
              <Card>
                <p className="text-xs uppercase text-neutral-500">Total reviews</p>
                <p className="mt-1 text-lg font-semibold text-neutral-900">{data.reviewCount}</p>
              </Card>
              <Card>
                <p className="text-xs uppercase text-neutral-500">Pending reviews</p>
                <p className="mt-1 text-lg font-semibold text-neutral-900">{data.pendingReviews}</p>
              </Card>
              <Card>
                <p className="text-xs uppercase text-neutral-500">Bookings by status</p>
                <p className="mt-1 text-xs text-neutral-700">
                  {Object.entries(data.bookingsByStatus).map(([status, count]) => `${status}: ${count}`).join(", ") || "-"}
                </p>
              </Card>
            </div>

            <Card>
              <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Bookings over time</h2>
              <BucketBarChart buckets={data.bookingsOverTime} />
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">Payment volume over time</h2>
              <BucketBarChart buckets={data.paymentVolumeOverTime} formatValue={formatInr} />
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">New customers over time</h2>
              <BucketBarChart buckets={data.newCustomersOverTime} />
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold uppercase text-neutral-500">New vendors over time</h2>
              <BucketBarChart buckets={data.newVendorsOverTime} />
            </Card>
          </div>
        )
      )}
    </div>
  );
}
