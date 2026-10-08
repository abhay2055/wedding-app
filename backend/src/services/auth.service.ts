import { Role, User } from "@prisma/client";
import { ApiError } from "../utils/apiError";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  hashToken,
  msFromExpiresIn,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { env } from "../config/env";
import * as userRepository from "../repositories/user.repository";
import * as refreshTokenRepository from "../repositories/refreshToken.repository";
import { randomUUID } from "crypto";

export type SafeUser = Omit<User, "passwordHash">;

export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

async function issueTokenPair(userId: string, role: Role): Promise<TokenPair> {
  const accessToken = signAccessToken({ sub: userId, role });

  const jti = randomUUID();
  const refreshToken = signRefreshToken({ sub: userId, jti });
  const refreshTokenExpiresAt = new Date(Date.now() + msFromExpiresIn(env.REFRESH_TOKEN_EXPIRES_IN));

  await refreshTokenRepository.storeRefreshToken({
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshTokenExpiresAt,
  });

  return { accessToken, refreshToken, refreshTokenExpiresAt };
}

// Public registration is intentionally hardcoded to CUSTOMER. Nothing in
// this function accepts a caller-supplied role.
export async function registerCustomer(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<{ user: SafeUser; tokens: TokenPair }> {
  const existing = await userRepository.findUserByEmail(input.email);
  if (existing) {
    throw ApiError.conflict("An account with this email already exists", "EMAIL_ALREADY_EXISTS");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await userRepository.createUser({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash,
    role: Role.CUSTOMER,
  });

  const tokens = await issueTokenPair(user.id, user.role);
  return { user: toSafeUser(user), tokens };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ user: SafeUser; tokens: TokenPair }> {
  const user = await userRepository.findUserByEmail(input.email);
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
  }

  if (!user.isActive) {
    throw ApiError.forbidden("This account has been deactivated", "ACCOUNT_INACTIVE");
  }

  const isValidPassword = await verifyPassword(input.password, user.passwordHash);
  if (!isValidPassword) {
    throw ApiError.unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
  }

  const tokens = await issueTokenPair(user.id, user.role);
  return { user: toSafeUser(user), tokens };
}

export async function refresh(currentRefreshToken: string): Promise<{ user: SafeUser; tokens: TokenPair }> {
  let payload;
  try {
    payload = verifyRefreshToken(currentRefreshToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
  }

  const tokenHash = hashToken(currentRefreshToken);
  const stored = await refreshTokenRepository.findActiveRefreshTokenByHash(tokenHash);
  if (!stored || stored.userId !== payload.sub) {
    throw ApiError.unauthorized("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
  }

  const user = await userRepository.findUserById(payload.sub);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
  }

  // Rotate: revoke the used refresh token and issue a brand new pair so a
  // stolen-but-already-used token cannot be replayed.
  await refreshTokenRepository.revokeRefreshTokenByHash(tokenHash);
  const tokens = await issueTokenPair(user.id, user.role);
  return { user: toSafeUser(user), tokens };
}

export async function logout(currentRefreshToken: string | undefined): Promise<void> {
  if (!currentRefreshToken) {
    return;
  }
  await refreshTokenRepository.revokeRefreshTokenByHash(hashToken(currentRefreshToken));
}
