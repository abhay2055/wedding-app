import { useEffect, useState } from "react";
import { Category } from "../types/api";
import * as categoriesApi from "../api/categories";

// Categories always come from the API - never hardcoded in a component -
// so the admin-managed category list is the single source of truth.
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    categoriesApi
      .listCategories()
      .then(setCategories)
      .catch(() => setError("Could not load categories."))
      .finally(() => setIsLoading(false));
  }, []);

  return { categories, isLoading, error };
}
