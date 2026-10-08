import { apiClient } from "./client";
import { User } from "../types/api";

export async function getMe(): Promise<User> {
  const res = await apiClient.get("/users/me");
  return res.data.data.user;
}

export async function updateMe(input: { name?: string; phone?: string }): Promise<User> {
  const res = await apiClient.patch("/users/me", input);
  return res.data.data.user;
}
