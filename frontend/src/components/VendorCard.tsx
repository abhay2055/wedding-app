import { Link } from "react-router-dom";
import { VendorSearchResult } from "../types/api";
import { VerificationBadge } from "./VerificationBadge";
import { SaveVendorButton } from "./SaveVendorButton";
import { StarRating } from "./StarRating";
import { formatInr } from "../utils/format";

interface VendorCardProps {
  vendor: VendorSearchResult;
  isSaved: boolean;
  onToggleSave: (vendorId: string) => void;
  isSaveLoading?: boolean;
  // Set only when the list is already filtered to available vendors (via
  // availableOn/availableFrom+availableTo) - every card shown then really
  // is available, so this is just a label, never computed client-side.
  availabilityLabel?: string;
}

export function VendorCard({ vendor, isSaved, onToggleSave, isSaveLoading, availabilityLabel }: VendorCardProps) {
  const coverImage = vendor.portfolio[0]?.thumbnailUrl ?? vendor.portfolio[0]?.url ?? null;

  return (
    <Link
      to={`/vendors/${vendor.slug}`}
      className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="aspect-[4/3] w-full bg-neutral-100">
        {coverImage ? (
          <img src={coverImage} alt={vendor.businessName} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">No photos yet</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-neutral-900">{vendor.businessName}</h3>
          <VerificationBadge status={vendor.verificationStatus} />
        </div>
        {vendor.category && <p className="text-sm text-neutral-500">{vendor.category.name}</p>}
        <p className="text-sm text-neutral-500">
          {vendor.locality ? `${vendor.locality}, ` : ""}
          {vendor.city}
        </p>
        <p className="text-sm font-medium text-brand-700">Starting at {formatInr(vendor.startingPrice)}</p>
        <p className="text-xs text-neutral-500">{vendor.eventsCompleted} events completed</p>
        {vendor.reviewCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-neutral-600">
            <StarRating value={vendor.averageRating} size="sm" />
            <span>
              {vendor.averageRating.toFixed(1)} ({vendor.reviewCount})
            </span>
          </div>
        )}
        {availabilityLabel && (
          <p className="inline-flex w-fit items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            ✓ {availabilityLabel}
          </p>
        )}
        <div className="mt-auto pt-2">
          <SaveVendorButton isSaved={isSaved} isLoading={isSaveLoading} onToggle={() => onToggleSave(vendor.id)} />
        </div>
      </div>
    </Link>
  );
}
