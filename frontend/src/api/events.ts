import { apiClient } from "./client";
import { WeddingEvent } from "../types/api";

export interface EventInput {
  name: string;
  city: string;
  weddingDate: string;
  endDate?: string;
  guestCount?: number;
  budgetMin?: number;
  budgetMax?: number;
  notes?: string;
  categoryIds?: string[];
}

export async function listMyEvents(): Promise<WeddingEvent[]> {
  const res = await apiClient.get("/events");
  return res.data.data.events;
}

export async function getMyEvent(id: string): Promise<WeddingEvent> {
  const res = await apiClient.get(`/events/${id}`);
  return res.data.data.event;
}

export async function createEvent(input: EventInput): Promise<WeddingEvent> {
  const res = await apiClient.post("/events", input);
  return res.data.data.event;
}

export async function updateEvent(id: string, input: Partial<EventInput>): Promise<WeddingEvent> {
  const res = await apiClient.patch(`/events/${id}`, input);
  return res.data.data.event;
}

export async function deleteEvent(id: string): Promise<void> {
  await apiClient.delete(`/events/${id}`);
}
