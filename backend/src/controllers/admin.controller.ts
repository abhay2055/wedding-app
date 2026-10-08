import { Request, Response } from "express";
import { VerificationStatus } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";
import * as userService from "../services/user.service";
import * as categoryService from "../services/category.service";
import * as vendorService from "../services/vendor.service";
import * as adminService from "../services/admin.service";
import { AdminVendorListQuery } from "../validators/adminVendor.validator";
import { AdminCustomerListQuery, SetCustomerStatusInput } from "../validators/adminCustomer.validator";
import { AdminAnalyticsQuery } from "../validators/adminAnalytics.validator";

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await userService.getMe(req.user.id);
  sendSuccess(res, { admin: user });
});

// --- Categories ---

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await categoryService.listAllCategoriesForAdmin();
  sendSuccess(res, { categories });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.createCategory(req.body);
  sendSuccess(res, { category }, 201);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  sendSuccess(res, { category });
});

// Deliberately a soft-deactivation, not a destructive delete - see
// category.service.deactivateCategory. Keeps vendor.categoryId relations intact.
export const deactivateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.deactivateCategory(req.params.id);
  sendSuccess(res, { category });
});

// --- Vendors ---

export const listVendors = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorService.listVendorsForAdmin(req.query as unknown as AdminVendorListQuery);
  sendSuccess(res, result);
});

export const getVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.getVendorForAdmin(req.params.id);
  sendSuccess(res, { vendor });
});

export const verifyVendor = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { verificationStatus } = req.body as { verificationStatus: VerificationStatus };
  const vendor = await vendorService.setVendorVerificationStatus(req.user.id, req.params.id, verificationStatus);
  sendSuccess(res, { vendor });
});

export const setVendorStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { isActive } = req.body as { isActive: boolean };
  const vendor = await vendorService.setVendorActiveStatus(req.user.id, req.params.id, isActive);
  sendSuccess(res, { vendor });
});

// --- Customers ---

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.listCustomersForAdmin(req.query as unknown as AdminCustomerListQuery);
  sendSuccess(res, result);
});

export const setCustomerStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { isActive } = req.body as SetCustomerStatusInput;
  const customer = await adminService.setCustomerActiveStatus(req.user.id, req.params.id, isActive);
  sendSuccess(res, { customer });
});

// --- Dashboard / analytics ---

export const getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await adminService.getDashboardStats();
  sendSuccess(res, stats);
});

export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { range } = req.query as unknown as AdminAnalyticsQuery;
  const analytics = await adminService.getAnalytics(range);
  sendSuccess(res, analytics);
});
