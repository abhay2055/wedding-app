import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

const withCategories = {
  interestedCategories: { include: { category: true } },
} satisfies Prisma.WeddingEventInclude;

export function findEventsByUserId(userId: string) {
  return prisma.weddingEvent.findMany({
    where: { userId },
    orderBy: { weddingDate: "asc" },
    include: withCategories,
  });
}

export function findEventById(id: string) {
  return prisma.weddingEvent.findUnique({ where: { id }, include: withCategories });
}

interface EventInput {
  name: string;
  city: string;
  weddingDate: Date;
  endDate?: Date;
  guestCount?: number;
  budgetMin?: number;
  budgetMax?: number;
  notes?: string;
  categoryIds?: string[];
}

export function createEvent(userId: string, data: EventInput) {
  return prisma.weddingEvent.create({
    data: {
      userId,
      name: data.name,
      city: data.city,
      weddingDate: data.weddingDate,
      endDate: data.endDate,
      guestCount: data.guestCount,
      budgetMin: data.budgetMin,
      budgetMax: data.budgetMax,
      notes: data.notes,
      interestedCategories: data.categoryIds
        ? { create: data.categoryIds.map((categoryId) => ({ categoryId })) }
        : undefined,
    },
    include: withCategories,
  });
}

export function updateEvent(id: string, data: Partial<EventInput>) {
  return prisma.$transaction(async (tx) => {
    if (data.categoryIds) {
      await tx.weddingEventCategory.deleteMany({ where: { weddingEventId: id } });
    }
    return tx.weddingEvent.update({
      where: { id },
      data: {
        name: data.name,
        city: data.city,
        weddingDate: data.weddingDate,
        endDate: data.endDate,
        guestCount: data.guestCount,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        notes: data.notes,
        interestedCategories: data.categoryIds
          ? { create: data.categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
      },
      include: withCategories,
    });
  });
}

export function deleteEvent(id: string) {
  return prisma.weddingEvent.delete({ where: { id } });
}
