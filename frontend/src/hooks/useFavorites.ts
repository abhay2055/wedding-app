import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import * as favoritesApi from "../api/favorites";

// Only a CUSTOMER can have favorites on the backend - for anyone else
// (unauthenticated, VENDOR, ADMIN) this just stays an empty set, and
// SaveVendorButton routes unauthenticated clicks to /login before this
// hook's toggle is ever called.
export function useFavorites() {
  const { user } = useAuth();
  const [favoriteVendorIds, setFavoriteVendorIds] = useState<Set<string>>(new Set());
  const [pendingVendorId, setPendingVendorId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== "CUSTOMER") {
      setFavoriteVendorIds(new Set());
      return;
    }
    favoritesApi
      .listMyFavorites()
      .then((favorites) => setFavoriteVendorIds(new Set(favorites.map((f) => f.vendorId))))
      .catch(() => undefined);
  }, [user?.id, user?.role]);

  const toggleFavorite = useCallback(
    async (vendorId: string) => {
      if (user?.role !== "CUSTOMER" || pendingVendorId) return;
      setPendingVendorId(vendorId);
      const isSaved = favoriteVendorIds.has(vendorId);
      try {
        if (isSaved) {
          await favoritesApi.removeFavorite(vendorId);
          setFavoriteVendorIds((prev) => {
            const next = new Set(prev);
            next.delete(vendorId);
            return next;
          });
        } else {
          await favoritesApi.addFavorite(vendorId);
          setFavoriteVendorIds((prev) => new Set(prev).add(vendorId));
        }
      } finally {
        setPendingVendorId(null);
      }
    },
    [favoriteVendorIds, pendingVendorId, user?.role],
  );

  return { favoriteVendorIds, toggleFavorite, isToggling: (vendorId: string) => pendingVendorId === vendorId };
}
