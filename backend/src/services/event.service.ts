import { ApiError } from "../utils/apiError";
import * as eventRepository from "../repositories/event.repository";
import { CreateEventInput, UpdateEventInput } from "../validators/event.validator";

export function listMyEvents(userId: string) {
  return eventRepository.findEventsByUserId(userId);
}

async function requireOwnEvent(userId: string, eventId: string) {
  const event = await eventRepository.findEventById(eventId);
  // 404 (not 403) for another customer's event - don't confirm it exists.
  if (!event || event.userId !== userId) {
    throw ApiError.notFound("Wedding event not found", "EVENT_NOT_FOUND");
  }
  return event;
}

export async function getMyEvent(userId: string, eventId: string) {
  return requireOwnEvent(userId, eventId);
}

export function createEvent(userId: string, input: CreateEventInput) {
  return eventRepository.createEvent(userId, input);
}

export async function updateEvent(userId: string, eventId: string, input: UpdateEventInput) {
  const existing = await requireOwnEvent(userId, eventId);

  const nextWeddingDate = input.weddingDate ?? existing.weddingDate;
  const nextEndDate = input.endDate ?? existing.endDate ?? undefined;
  if (nextEndDate && nextEndDate < nextWeddingDate) {
    throw ApiError.badRequest("endDate must be on or after weddingDate", "INVALID_EVENT_DATES");
  }

  const nextBudgetMin = input.budgetMin ?? existing.budgetMin ?? undefined;
  const nextBudgetMax = input.budgetMax ?? existing.budgetMax ?? undefined;
  if (nextBudgetMin !== undefined && nextBudgetMax !== undefined && nextBudgetMax < nextBudgetMin) {
    throw ApiError.badRequest("budgetMax must be greater than or equal to budgetMin", "INVALID_EVENT_BUDGET");
  }

  return eventRepository.updateEvent(eventId, input);
}

export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  await requireOwnEvent(userId, eventId);
  await eventRepository.deleteEvent(eventId);
}
