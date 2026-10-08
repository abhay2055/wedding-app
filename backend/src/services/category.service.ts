import { VendorCategory } from "@prisma/client";
import { ApiError } from "../utils/apiError";
import { slugify } from "../utils/slug";
import * as categoryRepository from "../repositories/category.repository";
import { CreateCategoryInput, UpdateCategoryInput } from "../validators/category.validator";

export function listActiveCategories(): Promise<VendorCategory[]> {
  return categoryRepository.findActiveCategories();
}

export function listAllCategoriesForAdmin() {
  return categoryRepository.findAllCategoriesWithVendorCount();
}

async function uniqueSlugFor(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;
  // Small category list - a linear probe is simple and fast enough here.
  for (;;) {
    const existing = await categoryRepository.findCategoryBySlug(candidate);
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function createCategory(input: CreateCategoryInput): Promise<VendorCategory> {
  const slug = await uniqueSlugFor(input.name);
  return categoryRepository.createCategory({
    name: input.name,
    slug,
    description: input.description,
  });
}

export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<VendorCategory> {
  const existing = await categoryRepository.findCategoryById(id);
  if (!existing) {
    throw ApiError.notFound("Category not found", "CATEGORY_NOT_FOUND");
  }

  const slug = input.name && input.name !== existing.name ? await uniqueSlugFor(input.name, id) : undefined;

  return categoryRepository.updateCategory(id, {
    name: input.name,
    slug,
    description: input.description,
    isActive: input.isActive,
  });
}

// Deactivation, not deletion: vendors keep their categoryId relation intact
// and an inactive category simply stops appearing in the public list and
// vendor-onboarding category picker.
export async function deactivateCategory(id: string): Promise<VendorCategory> {
  const existing = await categoryRepository.findCategoryById(id);
  if (!existing) {
    throw ApiError.notFound("Category not found", "CATEGORY_NOT_FOUND");
  }
  return categoryRepository.updateCategory(id, { isActive: false });
}
