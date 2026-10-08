import { prisma } from "../config/prisma";

const withVendor = {
  vendor: {
    include: { category: true, portfolio: { orderBy: { sortOrder: "asc" as const }, take: 1 } },
  },
};

export function findFavoritesByUserId(userId: string) {
  return prisma.favoriteVendor.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: withVendor,
  });
}

export function findFavorite(userId: string, vendorId: string) {
  return prisma.favoriteVendor.findUnique({
    where: { userId_vendorId: { userId, vendorId } },
  });
}

export function createFavorite(userId: string, vendorId: string) {
  return prisma.favoriteVendor.upsert({
    where: { userId_vendorId: { userId, vendorId } },
    update: {},
    create: { userId, vendorId },
  });
}

export function deleteFavorite(userId: string, vendorId: string) {
  return prisma.favoriteVendor.deleteMany({ where: { userId, vendorId } });
}
