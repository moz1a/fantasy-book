import type { Request, Response, NextFunction } from "express";

import {
  createAuthSession,
  deleteAuthSessionByTokenHash,
  findUserByAuthSessionTokenHash,
  type AuthUser,
} from "./repo.js";
import { addDays, generateSecretToken, hashToken } from "./tokens.js";
import { buildAuthCookie, buildClearAuthCookie, readAuthToken } from "./cookies.js";

function sessionTtlDays(): number {
  const value = Number(process.env.AUTH_SESSION_TTL_DAYS ?? "30");
  return Number.isFinite(value) && value > 0 ? value : 30;
}

export async function createSessionCookieForUser(
  res: Response,
  userId: string
): Promise<void> {
  const token = generateSecretToken();
  const expiresAt = addDays(new Date(), sessionTtlDays());

  await createAuthSession({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  res.setHeader("Set-Cookie", buildAuthCookie(token, expiresAt));
}

export async function clearSessionCookie(req: Request, res: Response): Promise<void> {
  const token = readAuthToken(req);

  if (token) {
    await deleteAuthSessionByTokenHash(hashToken(token));
  }

  res.setHeader("Set-Cookie", buildClearAuthCookie());
}

export async function getRequestUser(req: Request): Promise<AuthUser | null> {
  const token = readAuthToken(req);
  if (!token) return null;

  return findUserByAuthSessionTokenHash(hashToken(token));
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await getRequestUser(req);

    if (!user) {
      res.status(401).json({ error: "Требуется вход в аккаунт." });
      return;
    }

    res.locals.authUser = user;
    next();
  } catch (error) {
    next(error);
  }
}
