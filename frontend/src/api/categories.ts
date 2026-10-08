import { apiClient } from "./client";
import { Category } from "../types/api";

export async function listCategories(): Promise<Category[]> {
  const res = await apiClient.get("/categories");
  return res.data.data.categories;
}
