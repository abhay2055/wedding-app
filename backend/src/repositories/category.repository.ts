import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export function findActiveCategories() {
  return prisma.vendorCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export function findAllCategoriesWithVendorCount() {
  return prisma.vendorCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { vendors: true } } },
  });
}

export function findCategoryById(id: string) {
  return prisma.vendorCategory.findUnique({ where: { id } });
}

export function findCategoryBySlug(slug: string) {
  return prisma.vendorCategory.findUnique({ where: { slug } });
}

export function createCategory(data: Prisma.VendorCategoryUncheckedCreateInput) {
  return prisma.vendorCategory.create({ data });
}

export function updateCategory(id: string, data: Prisma.VendorCategoryUpdateInput) {
  return prisma.vendorCategory.update({ where: { id }, data });
}
