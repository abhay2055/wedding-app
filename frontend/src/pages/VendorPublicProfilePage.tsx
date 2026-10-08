import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as vendorApi from "../api/vendor";
import * as availabilityApi from "../api/availability";
import * as conversationsApi from "../api/conversations";
import * as reviewsApi from "../api/reviews";
import { AvailabilityStatus, VendorPublicProfile, VendorReviewListResult } from "../types/api";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../hooks/useFavorites";
import { VerificationBadge } from "../components/VerificationBadge";
import { SaveVendorButton } from "../components/SaveVendorButton";
import { AvailabilityCalendar, AvailabilityLegend } from "../components/AvailabilityCalendar";
import { RatingSummary } from "../components/RatingSummary";
import { ReviewCard } from "../components/ReviewCard";
import { StarRating } from "../components/StarRating";
import { Pagination } from "../components/Pagination";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { LoadingState } from "../components/LoadingState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { formatInr } from "../utils/format";
import { buildMonthGrid } from "../utils/dateOnly";

function VendorReviewsSection({ vendorId }: { vendorId: string }) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<VendorReviewListResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reviewsApi
      .listVendorReviews(vendorId, { page, limit: 10 })
      .then(setResult)
      .catch((err) => setError(extractErrorMessage(err)));
  }, [vendorId, page]);

  return (
    <Card>
      <h2 className="mb-4 text-lg font-medium">Reviews</h2>
      {error && <ErrorMessage message={error} />}
      {result && (
        <>
          <RatingSummary summary={result.summary} />
          {result.items.length > 0 && (
            <div className="mt-4 border-t border-neutral-100">
              {result.items.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
          <Pagination pagination={result.pagination} onPageChange={setPage} />
        </>
      )}
    </Card>
  );
}

function PublicAvailabilitySection({ vendorId }: { vendorId: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth());
  const [statusByDate, setStatusByDate] = useState<Record<string, AvailabilityStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const grid = buildMonthGrid(year, month);
    setIsLoading(true);
    setError(null);
    availabilityApi
      .getPublicAvailability(vendorId, grid[0].dateString, grid[grid.length - 1].dateString)
      .then((days) => {
        const map: Record<string, AvailabilityStatus> = {};
        for (const d of days) map[d.date] = d.status;
        setStatusByDate(map);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [vendorId, year, month]);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">Availability</h2>
        <AvailabilityLegend />
      </div>
      {error && <ErrorMessage message={error} />}
      {isLoading ? (
        <LoadingState label="Loading availability..." />
      ) : (
        <AvailabilityCalendar
          year={year}
          month={month}
          onMonthChange={(y, m) => { setYear(y); setMonth(m); }}
          statusByDate={statusByDate}
        />
      )}
      <p className="mt-3 text-xs text-neutral-500">
        Dates marked &quot;not updated&quot; mean this vendor hasn&apos;t confirmed their availability yet - contact
        them to check.
      </p>
    </Card>
  );
}

export function VendorPublicProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vendor, setVendor] = useState<VendorPublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const { favoriteVendorIds, toggleFavorite, isToggling } = useFavorites();

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    setError(null);
    vendorApi
      .getVendorProfileBySlug(slug)
      .then(setVendor)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [slug]);

  if (isLoading) return <LoadingState label="Loading vendor profile..." />;
  if (error) return <div className="mx-auto max-w-3xl px-4 py-8"><ErrorMessage message={error} /></div>;
  if (!vendor) return null;

  async function handleContactVendor() {
    if (!vendor) return;
    if (!user) {
      navigate("/login");
      return;
    }
    setIsStartingConversation(true);
    try {
      const conversation = await conversationsApi.getOrCreateConversation({ vendorId: vendor.id });
      navigate(`/dashboard/messages/${conversation.id}`);
    } finally {
      setIsStartingConversation(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-brand-800">{vendor.businessName}</h1>
            <VerificationBadge status={vendor.verificationStatus} />
          </div>
          {vendor.category && <p className="mt-1 text-neutral-600">{vendor.category.name}</p>}
          <p className="text-neutral-500">
            {vendor.locality ? `${vendor.locality}, ` : ""}
            {vendor.city}
          </p>
        </div>
        <div className="flex gap-2">
          <SaveVendorButton
            isSaved={favoriteVendorIds.has(vendor.id)}
            isLoading={isToggling(vendor.id)}
            onToggle={() => toggleFavorite(vendor.id)}
          />
          {(!user || user.role === "CUSTOMER") && (
            <Button variant="secondary" isLoading={isStartingConversation} onClick={handleContactVendor}>
              Contact Vendor
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs uppercase text-neutral-500">Starting price</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900">{formatInr(vendor.startingPrice)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-neutral-500">Experience</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900">
            {vendor.yearsExperience !== null ? `${vendor.yearsExperience} years` : "Not specified"}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-neutral-500">Events completed</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900">{vendor.eventsCompleted}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-neutral-500">Rating</p>
          {vendor.reviewCount > 0 ? (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-lg font-semibold text-neutral-900">{vendor.averageRating.toFixed(1)}</span>
              <StarRating value={vendor.averageRating} size="sm" />
            </div>
          ) : (
            <p className="mt-1 text-lg font-semibold text-neutral-900">No reviews yet</p>
          )}
        </Card>
      </div>

      {vendor.description && (
        <Card className="mt-6">
          <h2 className="mb-2 text-lg font-medium">About</h2>
          <p className="whitespace-pre-line text-neutral-700">{vendor.description}</p>
        </Card>
      )}

      <div className="mt-6">
        <PublicAvailabilitySection vendorId={vendor.id} />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-medium">Portfolio</h2>
        {vendor.portfolio.length === 0 ? (
          <p className="text-sm text-neutral-500">This vendor hasn&apos;t added any portfolio items yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {vendor.portfolio.map((item) =>
              item.type === "IMAGE" ? (
                <img
                  key={item.id}
                  src={item.thumbnailUrl ?? item.url}
                  alt={item.title ?? vendor.businessName}
                  className="aspect-square w-full rounded-md object-cover"
                  loading="lazy"
                />
              ) : (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex aspect-square w-full flex-col items-center justify-center rounded-md bg-neutral-900 text-sm text-white"
                >
                  <span>▶</span>
                  <span className="mt-1 px-2 text-center text-xs">{item.title ?? "Watch video"}</span>
                </a>
              ),
            )}
          </div>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-medium">Packages</h2>
        {vendor.packages.length === 0 ? (
          <p className="text-sm text-neutral-500">This vendor hasn&apos;t published any packages yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {vendor.packages.map((pkg) => (
              <Card key={pkg.id}>
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold text-neutral-900">{pkg.name}</h3>
                  <span className="text-brand-700 font-medium">{formatInr(pkg.price)}</span>
                </div>
                {pkg.description && <p className="mt-1 text-sm text-neutral-600">{pkg.description}</p>}
                {pkg.items.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                    {pkg.items.map((item) => (
                      <li key={item.id}>{item.name}</li>
                    ))}
                  </ul>
                )}
                {(!user || user.role === "CUSTOMER") && (
                  <div className="mt-4">
                    <Button
                      onClick={() =>
                        user
                          ? navigate(`/booking/new?vendorId=${vendor.id}&packageId=${pkg.id}`)
                          : navigate("/login")
                      }
                    >
                      Request Booking
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <VendorReviewsSection vendorId={vendor.id} />
      </div>
    </div>
  );
}
