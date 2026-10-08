import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { env, isProduction } from "../config/env";
import { msFromExpiresIn } from "../utils/jwt";
import * as authService from "../services/auth.service";

const REFRESH_COOKIE_NAME = "refreshToken";

function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    expires: expiresAt,
    path: "/api/v1/auth",
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/v1/auth" });
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { user, tokens } = await authService.registerCustomer(req.body);
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
  sendSuccess(
    res,
    {
      user,
      accessToken: tokens.accessToken,
      expiresIn: msFromExpiresIn(env.ACCESS_TOKEN_EXPIRES_IN) / 1000,
    },
    201,
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, tokens } = await authService.login(req.body);
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
  sendSuccess(res, {
    user,
    accessToken: tokens.accessToken,
    expiresIn: msFromExpiresIn(env.ACCESS_TOKEN_EXPIRES_IN) / 1000,
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: "MISSING_REFRESH_TOKEN", message: "No refresh token provided" },
    });
    return;
  }

  const { user, tokens } = await authService.refresh(token);
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
  sendSuccess(res, {
    user,
    accessToken: tokens.accessToken,
    expiresIn: msFromExpiresIn(env.ACCESS_TOKEN_EXPIRES_IN) / 1000,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  await authService.logout(token);
  clearRefreshCookie(res);
  sendSuccess(res, { loggedOut: true });
});
