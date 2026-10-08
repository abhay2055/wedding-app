const STAR_VALUES = [1, 2, 3, 4, 5] as const;

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = { sm: "text-sm", md: "text-lg", lg: "text-2xl" };

// Read-only when `onChange` is omitted (rendering a vendor's/review's
// rating); interactive (click to set) when provided (the review form).
export function StarRating({ value, onChange, size = "md" }: StarRatingProps) {
  const interactive = Boolean(onChange);
  return (
    <div className={`inline-flex items-center gap-0.5 ${SIZE_CLASSES[size]}`} role={interactive ? "radiogroup" : undefined} aria-label={interactive ? "Rating" : `${value} out of 5 stars`}>
      {STAR_VALUES.map((star) => {
        const filled = star <= Math.round(value);
        const className = filled ? "text-amber-500" : "text-neutral-300";
        if (!interactive) {
          return (
            <span key={star} className={className} aria-hidden="true">
              ★
            </span>
          );
        }
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === value}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onClick={() => onChange?.(star)}
            className={`${className} transition-colors hover:text-amber-500`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
