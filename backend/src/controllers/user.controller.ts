import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";
import * as userService from "../services/user.service";

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await userService.getMe(req.user.id);
  sendSuccess(res, { user });
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await userService.updateMe(req.user.id, req.body);
  sendSuccess(res, { user });
});
