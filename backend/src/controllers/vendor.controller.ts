import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";
import * as vendorService from "../services/vendor.service";
import { VendorSearchQuery } from "../validators/vendor.validator";

export const searchVendors = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorService.searchVendors(req.query as unknown as VendorSearchQuery);
  sendSuccess(res, result);
});

export const getPublicVendorProfile = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.getPublicVendorProfile(req.params.id);
  sendSuccess(res, { vendor });
});

export const getPublicVendorProfileBySlug = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.getPublicVendorProfileBySlug(req.params.slug);
  sendSuccess(res, { vendor });
});

export const getMyVendorProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const vendor = await vendorService.getMyVendorProfile(req.user.id);
  sendSuccess(res, { vendor });
});

export const createMyVendorProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const vendor = await vendorService.createMyVendorProfile(req.user.id, req.body);
  sendSuccess(res, { vendor }, 201);
});

export const updateMyVendorProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const vendor = await vendorService.updateMyVendorProfile(req.user.id, req.body);
  sendSuccess(res, { vendor });
});
