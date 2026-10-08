import { apiClient } from "./client";
import { AuthResponse } from "../types/api";

export async function registerCustomer(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await apiClient.post("/auth/register", input);
  return res.data.data;
}

export async function login(input: { email: string; password: string }): Promise<AuthResponse> {
  const res = await apiClient.post("/auth/login", input);
  return res.data.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function refreshSession(): Promise<AuthResponse> {
  const res = await apiClient.post("/auth/refresh");
  return res.data.data;
}
