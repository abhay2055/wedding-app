import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";
import * as favoriteService from "../services/favorite.service";

export const listMyFavorites = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const favorites = await favoriteService.listMyFavorites(req.user.id);
  sendSuccess(res, { favorites });
});

export const addFavorite = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await favoriteService.addFavorite(req.user.id, req.params.vendorId);
  sendSuccess(res, { favorited: true }, 201);
});

export const removeFavorite = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await favoriteService.removeFavorite(req.user.id, req.params.vendorId);
  sendSuccess(res, { favorited: false });
});
