import { AvailabilityStatus, VendorAvailability } from "@prisma/client";
import { ApiError } from "../utils/apiError";
import { enumerateDatesInclusive, parseDateOnly, todayUTC } from "../utils/dateOnly";
import * as availabilityRepository from "../repositories/availability.repository";
import * as vendorRepository from "../repositories/vendor.repository";
import * as auditService from "./audit.service";
import {
  BulkAvailabilityInput,
  CreateAvailabilityInput,
  UpdateAvailabilityInput,
} from "../validators/availability.validator";

async function requireOwnVendor(userId: string) {
  const vendor = await vendorRepository.findVendorByUserId(userId);
  if (!vendor) {
    throw ApiError.notFound("Vendor profile not found", "VENDOR_PROFILE_NOT_FOUND");
  }
  return vendor;
}

async function requireOwnAvailability(userId: string, availabilityId: string): Promise<VendorAvailability> {
  const vendor = await requireOwnVendor(userId);
  const record = await availabilityRepository.findById(availabilityId);
  // 404 (not 403) for another vendor's record - don't confirm it exists.
  if (!record || record.vendorId !== vendor.id) {
    throw ApiError.notFound("Availability record not found", "AVAILABILITY_NOT_FOUND");
  }
  return record;
}

function assertNotPast(date: Date): void {
  if (date.getTime() < todayUTC().getTime()) {
    throw ApiError.badRequest("Cannot set availability for a past date", "PAST_DATE_NOT_ALLOWED");
  }
}

export async function listMyAvailability(userId: string, from?: Date, to?: Date) {
  const vendor = await requireOwnVendor(userId);
  return availabilityRepository.findByVendorAndRange(vendor.id, from, to);
}

export async function setMyAvailability(userId: string, input: CreateAvailabilityInput): Promise<VendorAvailability> {
  const vendor = await requireOwnVendor(userId);
  const date = parseDateOnly(input.date)!;
  assertNotPast(date);
  return availabilityRepository.upsertOne(vendor.id, date, input.status as AvailabilityStatus, input.note);
}

export async function bulkSetMyAvailability(userId: string, input: BulkAvailabilityInput): Promise<VendorAvailability[]> {
  const vendor = await requireOwnVendor(userId);
  const startDate = parseDateOnly(input.startDate)!;
  const endDate = parseDateOnly(input.endDate)!;
  assertNotPast(startDate);
  const dates = enumerateDatesInclusive(startDate, endDate);
  return availabilityRepository.upsertMany(vendor.id, dates, input.status as AvailabilityStatus, input.note);
}

export async function updateMyAvailability(
  userId: string,
  availabilityId: string,
  input: UpdateAvailabilityInput,
): Promise<VendorAvailability> {
  await requireOwnAvailability(userId, availabilityId);
  return availabilityRepository.updateById(availabilityId, {
    status: input.status as AvailabilityStatus | undefined,
    note: input.note,
  });
}

export async function deleteMyAvailability(userId: string, availabilityId: string): Promise<void> {
  await requireOwnAvailability(userId, availabilityId);
  await availabilityRepository.deleteById(availabilityId);
}

export interface PublicAvailabilityDay {
  date: string;
  status: AvailabilityStatus;
}

// Public callers only ever see {date, status} - never `note`, `id` or
// `vendorId`. Reuses the same public-vendor-visibility rule as the rest of
// the marketplace (404 for a rejected/inactive vendor), so a hidden
// vendor's calendar can't be probed even though this is a different endpoint.
export async function getPublicAvailability(vendorId: string, from?: Date, to?: Date): Promise<PublicAvailabilityDay[]> {
  const vendor = await vendorRepository.findPublicVendorById(vendorId);
  if (!vendor) {
    throw ApiError.notFound("Vendor not found", "VENDOR_NOT_FOUND");
  }
  const records = await availabilityRepository.findByVendorAndRange(vendorId, from, to);
  return records.map((r) => ({ date: r.date.toISOString().slice(0, 10), status: r.status }));
}

// --- Admin ---

export async function getVendorAvailabilityForAdmin(vendorId: string, from?: Date, to?: Date) {
  const vendor = await vendorRepository.findVendorById(vendorId);
  if (!vendor) {
    throw ApiError.notFound("Vendor not found", "VENDOR_NOT_FOUND");
  }
  return availabilityRepository.findByVendorAndRange(vendorId, from, to);
}

export async function adminSetVendorAvailability(
  adminUserId: string,
  vendorId: string,
  date: Date,
  status: AvailabilityStatus,
  note: string | undefined,
): Promise<VendorAvailability> {
  const vendor = await vendorRepository.findVendorById(vendorId);
  if (!vendor) {
    throw ApiError.notFound("Vendor not found", "VENDOR_NOT_FOUND");
  }

  const existing = await availabilityRepository.findByVendorAndRange(vendorId, date, date);
  const oldStatus = existing[0]?.status ?? null;

  const updated = await availabilityRepository.upsertOne(vendorId, date, status, note);

  await auditService.recordAdminAction(adminUserId, "AVAILABILITY_UPDATE", "VendorAvailability", vendorId, {
    date: date.toISOString().slice(0, 10),
    oldStatus,
    newStatus: status,
  });

  return updated;
}
