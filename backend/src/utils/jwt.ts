import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { Role } from "@prisma/client";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

// Refresh tokens are only ever stored server-side as a SHA-256 hash so a
// database read/leak cannot be replayed as a live session token.
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function msFromExpiresIn(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) {
    throw new Error(`Unsupported duration format: ${expiresIn}`);
  }
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * unitMs[unit];
}
