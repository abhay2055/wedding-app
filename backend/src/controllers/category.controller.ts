import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import * as categoryService from "../services/category.service";

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await categoryService.listActiveCategories();
  sendSuccess(res, { categories });
});
