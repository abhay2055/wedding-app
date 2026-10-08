import { useEffect, useState } from "react";
import * as favoritesApi from "../api/favorites";
import { FavoriteVendor } from "../types/api";
import { VendorCard } from "../components/VendorCard";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { Button } from "../components/Button";
import { Link } from "react-router-dom";

export function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteVendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    favoritesApi
      .listMyFavorites()
      .then(setFavorites)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  async function handleToggle(vendorId: string) {
    setRemovingId(vendorId);
    try {
      await favoritesApi.removeFavorite(vendorId);
      setFavorites((prev) => prev.filter((f) => f.vendorId !== vendorId));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-brand-800">Saved vendors</h1>

      {isLoading && <LoadingState label="Loading your saved vendors..." />}
      {!isLoading && error && <ErrorMessage message={error} />}
      {!isLoading && !error && favorites.length === 0 && (
        <EmptyState
          title="You haven't saved any vendors yet."
          description="Browse the marketplace and tap Save on vendors you like."
          action={
            <Link to="/vendors">
              <Button>Browse vendors</Button>
            </Link>
          }
        />
      )}
      {!isLoading && !error && favorites.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((fav) => (
            <VendorCard
              key={fav.id}
              vendor={fav.vendor}
              isSaved
              isSaveLoading={removingId === fav.vendorId}
              onToggleSave={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
