import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as vendorApi from "../api/vendor";
import * as eventsApi from "../api/events";
import { WeddingEvent, VendorSearchResult, VendorSortOption } from "../types/api";
import { useAuth } from "../context/AuthContext";
import { useCategories } from "../hooks/useCategories";
import { useFavorites } from "../hooks/useFavorites";
import { VendorCard } from "../components/VendorCard";
import { Pagination } from "../components/Pagination";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { formatDateOnlyDisplay } from "../utils/dateOnly";

const SORT_OPTIONS: { value: VendorSortOption; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest" },
  { value: "most_events", label: "Most events completed" },
  { value: "rating", label: "Highest rated" },
];

const MIN_RATING_OPTIONS = [
  { value: "", label: "Any rating" },
  { value: "4", label: "4★ & up" },
  { value: "3", label: "3★ & up" },
];

export function VendorSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { categories } = useCategories();
  const { favoriteVendorIds, toggleFavorite, isToggling } = useFavorites();

  const [items, setItems] = useState<VendorSearchResult[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myEvent, setMyEvent] = useState<WeddingEvent | null>(null);

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [minPriceInput, setMinPriceInput] = useState(searchParams.get("minPrice") ?? "");
  const [maxPriceInput, setMaxPriceInput] = useState(searchParams.get("maxPrice") ?? "");
  const [cityInput, setCityInput] = useState(searchParams.get("city") ?? "");
  const [dateInput, setDateInput] = useState(searchParams.get("availableOn") ?? "");

  const category = searchParams.get("category") ?? "";
  const verified = searchParams.get("verified") === "true";
  const minRating = searchParams.get("minRating") ?? "";
  const sort = (searchParams.get("sort") as VendorSortOption) || "relevance";
  const page = Number(searchParams.get("page") ?? "1");
  const availableOn = searchParams.get("availableOn") ?? undefined;
  const availableFrom = searchParams.get("availableFrom") ?? undefined;
  const availableTo = searchParams.get("availableTo") ?? undefined;

  useEffect(() => {
    if (user?.role !== "CUSTOMER") return;
    eventsApi
      .listMyEvents()
      .then((events) => setMyEvent(events[0] ?? null))
      .catch(() => undefined);
  }, [user?.role]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    vendorApi
      .searchVendors({
        category: category || undefined,
        city: searchParams.get("city") || undefined,
        minPrice: searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined,
        maxPrice: searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined,
        verified: verified || undefined,
        search: searchParams.get("search") || undefined,
        minRating: minRating ? Number(minRating) : undefined,
        availableOn,
        availableFrom,
        availableTo,
        page,
        limit: 20,
        sort,
      })
      .then((res) => {
        setItems(res.items);
        setPagination(res.pagination);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function updateParams(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in updates)) next.delete("page");
    setSearchParams(next);
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParams({
      search: searchInput,
      city: cityInput,
      minPrice: minPriceInput,
      maxPrice: maxPriceInput,
      availableOn: dateInput || undefined,
      availableFrom: undefined,
      availableTo: undefined,
    });
  }

  function handleCheckMyWeddingDate() {
    if (!myEvent) return;
    setDateInput("");
    const next = new URLSearchParams(searchParams);
    next.delete("availableOn");
    if (myEvent.endDate && myEvent.endDate.slice(0, 10) !== myEvent.weddingDate.slice(0, 10)) {
      next.set("availableFrom", myEvent.weddingDate.slice(0, 10));
      next.set("availableTo", myEvent.endDate.slice(0, 10));
    } else {
      next.set("availableOn", myEvent.weddingDate.slice(0, 10));
    }
    next.delete("page");
    setSearchParams(next);
  }

  function clearDateFilter() {
    setDateInput("");
    updateParams({ availableOn: undefined, availableFrom: undefined, availableTo: undefined });
  }

  const activeDateFilterLabel = availableOn
    ? `Available ${formatDateOnlyDisplay(availableOn)}`
    : availableFrom && availableTo
      ? `Available ${formatDateOnlyDisplay(availableFrom)} - ${formatDateOnlyDisplay(availableTo)}`
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-brand-800">Find wedding vendors</h1>

      {myEvent && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="text-sm text-brand-800">
            Your wedding: <strong>{formatDateOnlyDisplay(myEvent.weddingDate)}</strong>
            {myEvent.endDate && myEvent.endDate.slice(0, 10) !== myEvent.weddingDate.slice(0, 10)
              ? ` - ${formatDateOnlyDisplay(myEvent.endDate)}`
              : ""}
          </p>
          <Button type="button" variant="secondary" onClick={handleCheckMyWeddingDate}>
            Check availability for your wedding date
          </Button>
        </div>
      )}

      {activeDateFilterLabel && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm text-green-800">
            Showing vendors {activeDateFilterLabel.toLowerCase()}
          </p>
          <Button type="button" variant="secondary" onClick={clearDateFilter}>
            Clear date filter
          </Button>
        </div>
      )}

      <form onSubmit={handleFilterSubmit} className="mb-6 grid grid-cols-1 gap-4 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Search vendors" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="e.g. Photography" />
        <Input label="City" value={cityInput} onChange={(e) => setCityInput(e.target.value)} placeholder="e.g. Mumbai" />
        <Input label="Wedding date" type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
        <Input label="Min price" type="number" min={0} value={minPriceInput} onChange={(e) => setMinPriceInput(e.target.value)} />
        <Input label="Max price" type="number" min={0} value={maxPriceInput} onChange={(e) => setMaxPriceInput(e.target.value)} />

        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
          <label htmlFor="category-filter" className="text-sm font-medium text-neutral-700">Category</label>
          <select
            id="category-filter"
            value={category}
            onChange={(e) => updateParams({ category: e.target.value })}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="min-rating-select" className="text-sm font-medium text-neutral-700">Minimum rating</label>
          <select
            id="min-rating-select"
            value={minRating}
            onChange={(e) => updateParams({ minRating: e.target.value || undefined })}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            {MIN_RATING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="sort-select" className="text-sm font-medium text-neutral-700">Sort by</label>
          <select
            id="sort-select"
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value })}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 self-end pb-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => updateParams({ verified: e.target.checked ? "true" : undefined })}
          />
          Verified only
        </label>

        <div className="self-end">
          <Button type="submit">Apply filters</Button>
        </div>
      </form>

      {isLoading && <LoadingState label="Loading vendors..." />}
      {!isLoading && error && <ErrorMessage message={error} />}
      {!isLoading && !error && items.length === 0 && (
        <EmptyState
          title="No vendors found."
          description={activeDateFilterLabel ? "No vendors have confirmed availability for this date yet. Try a different date or clear the date filter." : "Try changing your filters."}
        />
      )}
      {!isLoading && !error && items.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((vendor) => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                isSaved={favoriteVendorIds.has(vendor.id)}
                isSaveLoading={isToggling(vendor.id)}
                onToggleSave={toggleFavorite}
                availabilityLabel={activeDateFilterLabel ?? undefined}
              />
            ))}
          </div>
          <Pagination pagination={pagination} onPageChange={(p) => updateParams({ page: String(p) })} />
        </>
      )}
    </div>
  );
}
