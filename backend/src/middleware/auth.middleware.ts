import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { ApiError } from "../utils/apiError";
import { verifyAccessToken } from "../utils/jwt";

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Missing or invalid Authorization header");
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    throw ApiError.unauthorized("Invalid or expired access token");
  }
}

// Role is always read from the verified JWT/DB-backed session (set by
// requireAuth), never from anything the client sends in the request body.
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden("You do not have permission to access this resource");
    }
    next();
  };
}
