import { randomUUID } from "node:crypto";

import { pool } from "../db/db.js";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
};

type UserRow = {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  created_at: Date;
};

type PublicUserRow = Omit<UserRow, "password_hash">;

function toAuthUser(row: PublicUserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    emailVerified: row.email_verified,
    createdAt: row.created_at.toISOString(),
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

export async function createUser(params: {
  username: string;
  email: string;
  passwordHash: string;
}): Promise<AuthUser> {
  const result = await pool.query<PublicUserRow>(
    `
      INSERT INTO users (id, username, email, password_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, email, email_verified, created_at
    `,
    [randomUUID(), params.username.trim(), normalizeEmail(params.email), params.passwordHash]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to create user");
  }

  return toAuthUser(row);
}

export async function findUserByLogin(login: string): Promise<UserRow | null> {
  const normalized = normalizeLogin(login);
  const result = await pool.query<UserRow>(
    `
      SELECT id, username, email, password_hash, email_verified, created_at
      FROM users
      WHERE LOWER(email) = $1 OR LOWER(username) = $1
      LIMIT 1
    `,
    [normalized]
  );

  return result.rows[0] ?? null;
}

export async function findPublicUserById(userId: string): Promise<AuthUser | null> {
  const result = await pool.query<PublicUserRow>(
    `
      SELECT id, username, email, email_verified, created_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  const row = result.rows[0];
  return row ? toAuthUser(row) : null;
}

export async function createAuthSession(params: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  await pool.query(
    `
      INSERT INTO auth_sessions (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [randomUUID(), params.userId, params.tokenHash, params.expiresAt]
  );
}

export async function findUserByAuthSessionTokenHash(
  tokenHash: string
): Promise<AuthUser | null> {
  const sessionResult = await pool.query<{ user_id: string }>(
    `
      UPDATE auth_sessions
      SET last_used_at = NOW()
      WHERE token_hash = $1 AND expires_at > NOW()
      RETURNING user_id
    `,
    [tokenHash]
  );

  const session = sessionResult.rows[0];
  if (!session) {
    return null;
  }

  return findPublicUserById(session.user_id);
}

export async function deleteAuthSessionByTokenHash(tokenHash: string): Promise<void> {
  await pool.query(
    `
      DELETE FROM auth_sessions
      WHERE token_hash = $1
    `,
    [tokenHash]
  );
}

export async function deleteExpiredAuthSessions(): Promise<void> {
  await pool.query(
    `
      DELETE FROM auth_sessions
      WHERE expires_at <= NOW()
    `
  );
}

export async function createEmailVerificationToken(params: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  await pool.query(
    `
      DELETE FROM email_verification_tokens
      WHERE user_id = $1
    `,
    [params.userId]
  );

  await pool.query(
    `
      INSERT INTO email_verification_tokens (token_hash, user_id, expires_at)
      VALUES ($1, $2, $3)
    `,
    [params.tokenHash, params.userId, params.expiresAt]
  );
}

export async function consumeEmailVerificationToken(
  tokenHash: string
): Promise<AuthUser | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tokenResult = await client.query<{ user_id: string }>(
      `
        SELECT user_id
        FROM email_verification_tokens
        WHERE token_hash = $1 AND expires_at > NOW()
        FOR UPDATE
      `,
      [tokenHash]
    );

    const tokenRow = tokenResult.rows[0];
    if (!tokenRow) {
      await client.query("ROLLBACK");
      return null;
    }

    const userResult = await client.query<PublicUserRow>(
      `
        UPDATE users
        SET email_verified = TRUE, updated_at = NOW()
        WHERE id = $1
        RETURNING id, username, email, email_verified, created_at
      `,
      [tokenRow.user_id]
    );

    await client.query(
      `
        DELETE FROM email_verification_tokens
        WHERE user_id = $1
      `,
      [tokenRow.user_id]
    );

    await client.query("COMMIT");

    const userRow = userResult.rows[0];
    return userRow ? toAuthUser(userRow) : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
