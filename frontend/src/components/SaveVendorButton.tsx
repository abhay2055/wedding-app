import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface SaveVendorButtonProps {
  isSaved: boolean;
  isLoading?: boolean;
  onToggle: () => void;
  className?: string;
}

// Only a CUSTOMER can save vendors on the backend; an unauthenticated click
// goes to login instead of silently failing, and a logged-in VENDOR/ADMIN
// simply doesn't get the option (see callers).
export function SaveVendorButton({ isSaved, isLoading, onToggle, className = "" }: SaveVendorButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate("/login");
      return;
    }
    onToggle();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      aria-pressed={isSaved}
      aria-label={isSaved ? "Remove from saved vendors" : "Save vendor"}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
        isSaved
          ? "border-brand-300 bg-brand-50 text-brand-700"
          : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
      } ${className}`}
    >
      <span aria-hidden="true">{isSaved ? "♥" : "♡"}</span>
      {isSaved ? "Saved" : "Save"}
    </button>
  );
}
