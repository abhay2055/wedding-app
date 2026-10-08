import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export function findPortfolioByVendorId(vendorId: string) {
  return prisma.vendorPortfolio.findMany({
    where: { vendorId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export function findPortfolioItemById(id: string) {
  return prisma.vendorPortfolio.findUnique({ where: { id } });
}

export function createPortfolioItem(data: Prisma.VendorPortfolioUncheckedCreateInput) {
  return prisma.vendorPortfolio.create({ data });
}

export function updatePortfolioItem(id: string, data: Prisma.VendorPortfolioUpdateInput) {
  return prisma.vendorPortfolio.update({ where: { id }, data });
}

export function deletePortfolioItem(id: string) {
  return prisma.vendorPortfolio.delete({ where: { id } });
}
