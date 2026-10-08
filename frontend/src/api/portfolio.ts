import { apiClient } from "./client";
import { PortfolioItem } from "../types/api";

export async function listMyPortfolio(): Promise<PortfolioItem[]> {
  const res = await apiClient.get("/vendors/me/portfolio");
  return res.data.data.portfolio;
}

export async function addImagePortfolioItem(file: File, title?: string): Promise<PortfolioItem> {
  const formData = new FormData();
  formData.append("type", "IMAGE");
  formData.append("file", file);
  if (title) formData.append("title", title);

  // Content-Type is left unset so the browser fills in the multipart
  // boundary itself - setting it manually here would break upload parsing.
  const res = await apiClient.post("/vendors/me/portfolio", formData);
  return res.data.data.item;
}

export async function addVideoPortfolioItem(url: string, title?: string): Promise<PortfolioItem> {
  const res = await apiClient.post("/vendors/me/portfolio", { type: "VIDEO", url, title });
  return res.data.data.item;
}

export async function deletePortfolioItem(id: string): Promise<void> {
  await apiClient.delete(`/vendors/me/portfolio/${id}`);
}
