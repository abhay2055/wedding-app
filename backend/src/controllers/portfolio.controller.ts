import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";
import * as portfolioService from "../services/portfolio.service";

export const listMyPortfolio = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const portfolio = await portfolioService.listMyPortfolio(req.user.id);
  sendSuccess(res, { portfolio });
});

export const addPortfolioItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const item = await portfolioService.addPortfolioItem(req.user.id, req.body, req.file);
  sendSuccess(res, { item }, 201);
});

export const updatePortfolioItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const item = await portfolioService.updatePortfolioItem(req.user.id, req.params.id, req.body);
  sendSuccess(res, { item });
});

export const deletePortfolioItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await portfolioService.deletePortfolioItem(req.user.id, req.params.id);
  sendSuccess(res, { deleted: true });
});
