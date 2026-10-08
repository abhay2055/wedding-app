import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

const withItems = {
  items: { orderBy: { sortOrder: Prisma.SortOrder.asc } },
} satisfies Prisma.VendorPackageInclude;

export function findPackagesByVendorId(vendorId: string) {
  return prisma.vendorPackage.findMany({
    where: { vendorId },
    orderBy: { createdAt: "asc" },
    include: withItems,
  });
}

export function findActivePackagesByVendorId(vendorId: string) {
  return prisma.vendorPackage.findMany({
    where: { vendorId, isActive: true },
    orderBy: { createdAt: "asc" },
    include: withItems,
  });
}

export function findPackageById(id: string) {
  return prisma.vendorPackage.findUnique({ where: { id }, include: withItems });
}

export function createPackage(data: {
  vendorId: string;
  name: string;
  description?: string;
  price: number;
  advancePercentage?: number;
  items?: { name: string; description?: string; sortOrder?: number }[];
}) {
  return prisma.vendorPackage.create({
    data: {
      vendorId: data.vendorId,
      name: data.name,
      description: data.description,
      price: data.price,
      advancePercentage: data.advancePercentage,
      items: data.items ? { create: data.items } : undefined,
    },
    include: withItems,
  });
}

export function updatePackage(
  id: string,
  data: {
    name?: string;
    description?: string;
    price?: number;
    advancePercentage?: number;
    isActive?: boolean;
    items?: { name: string; description?: string; sortOrder?: number }[];
  },
) {
  return prisma.$transaction(async (tx) => {
    if (data.items) {
      await tx.vendorPackageItem.deleteMany({ where: { packageId: id } });
    }
    return tx.vendorPackage.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        advancePercentage: data.advancePercentage,
        isActive: data.isActive,
        items: data.items ? { create: data.items } : undefined,
      },
      include: withItems,
    });
  });
}

export function deletePackage(id: string) {
  return prisma.vendorPackage.delete({ where: { id } });
}
