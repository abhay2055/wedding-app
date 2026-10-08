import { PortfolioMediaType, VendorPortfolio } from "@prisma/client";
import { ApiError } from "../utils/apiError";
import { storage } from "../utils/storage";
import { extensionForMimeType } from "../middleware/upload.middleware";
import * as portfolioRepository from "../repositories/portfolio.repository";
import * as vendorRepository from "../repositories/vendor.repository";
import { CreatePortfolioItemInput, UpdatePortfolioItemInput } from "../validators/portfolio.validator";

async function requireOwnVendor(userId: string) {
  const vendor = await vendorRepository.findVendorByUserId(userId);
  if (!vendor) {
    throw ApiError.notFound("Vendor profile not found", "VENDOR_PROFILE_NOT_FOUND");
  }
  return vendor;
}

async function requireOwnPortfolioItem(userId: string, portfolioItemId: string): Promise<VendorPortfolio> {
  const vendor = await requireOwnVendor(userId);
  const item = await portfolioRepository.findPortfolioItemById(portfolioItemId);
  // 404 (not 403) for another vendor's item, so the response doesn't confirm
  // that a given portfolio item id belongs to someone else.
  if (!item || item.vendorId !== vendor.id) {
    throw ApiError.notFound("Portfolio item not found", "PORTFOLIO_ITEM_NOT_FOUND");
  }
  return item;
}

export function listMyPortfolio(userId: string) {
  return requireOwnVendor(userId).then((vendor) => portfolioRepository.findPortfolioByVendorId(vendor.id));
}

export async function addPortfolioItem(
  userId: string,
  input: CreatePortfolioItemInput,
  file: { buffer: Buffer; mimetype: string } | undefined,
): Promise<VendorPortfolio> {
  const vendor = await requireOwnVendor(userId);

  if (input.type === PortfolioMediaType.VIDEO) {
    if (!input.url) {
      throw ApiError.badRequest("A video URL is required for VIDEO portfolio items", "PORTFOLIO_URL_REQUIRED");
    }
    return portfolioRepository.createPortfolioItem({
      vendorId: vendor.id,
      type: PortfolioMediaType.VIDEO,
      url: input.url,
      title: input.title,
      description: input.description,
      sortOrder: input.sortOrder ?? 0,
    });
  }

  if (!file) {
    throw ApiError.badRequest("An image file is required for IMAGE portfolio items", "PORTFOLIO_FILE_REQUIRED");
  }

  const stored = await storage.saveImage({
    buffer: file.buffer,
    originalExtension: extensionForMimeType(file.mimetype),
  });

  return portfolioRepository.createPortfolioItem({
    vendorId: vendor.id,
    type: PortfolioMediaType.IMAGE,
    url: stored.url,
    thumbnailUrl: stored.url,
    title: input.title,
    description: input.description,
    sortOrder: input.sortOrder ?? 0,
  });
}

export async function updatePortfolioItem(
  userId: string,
  portfolioItemId: string,
  input: UpdatePortfolioItemInput,
): Promise<VendorPortfolio> {
  await requireOwnPortfolioItem(userId, portfolioItemId);
  return portfolioRepository.updatePortfolioItem(portfolioItemId, {
    title: input.title,
    description: input.description,
    sortOrder: input.sortOrder,
    url: input.url,
  });
}

export async function deletePortfolioItem(userId: string, portfolioItemId: string): Promise<void> {
  const item = await requireOwnPortfolioItem(userId, portfolioItemId);
  await portfolioRepository.deletePortfolioItem(portfolioItemId);
  await storage.deleteByUrl(item.url);
}
