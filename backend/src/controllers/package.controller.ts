import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";
import * as packageService from "../services/package.service";

export const listMyPackages = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const packages = await packageService.listMyPackages(req.user.id);
  sendSuccess(res, { packages });
});

export const getMyPackage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const pkg = await packageService.getMyPackage(req.user.id, req.params.id);
  sendSuccess(res, { package: pkg });
});

export const createPackage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const pkg = await packageService.createPackage(req.user.id, req.body);
  sendSuccess(res, { package: pkg }, 201);
});

export const updatePackage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const pkg = await packageService.updatePackage(req.user.id, req.params.id, req.body);
  sendSuccess(res, { package: pkg });
});

export const deletePackage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await packageService.deletePackage(req.user.id, req.params.id);
  sendSuccess(res, { deleted: true });
});
