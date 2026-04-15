import express from "express";
import { z } from "zod";

import {
  consumeEmailVerificationToken,
  createEmailVerificationToken,
  createUser,
  deleteExpiredAuthSessions,
  findUserByLogin,
  type AuthUser,
} from "./repo.js";
import { hashPassword, verifyPassword } from "./password.js";
import { addHours, generateSecretToken, hashToken } from "./tokens.js";
import {
  clearSessionCookie,
  createSessionCookieForUser,
  getRequestUser,
  requireAuth,
} from "./session.js";
import { sendVerificationEmail } from "./email.js";

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Логин должен быть не короче 3 символов.")
    .max(32, "Логин должен быть не длиннее 32 символов.")
    .regex(/^[\p{L}\p{N}_-]+$/u, "В логине можно использовать буквы, цифры, _ и -."),
  email: z
    .string()
    .trim()
    .email("Введите корректную почту.")
    .max(254, "Почта слишком длинная.")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, "Пароль должен быть не короче 8 символов.")
    .max(128, "Пароль слишком длинный."),
});

const loginSchema = z.object({
  login: z
    .string()
    .trim()
    .min(1, "Введите логин или почту.")
    .max(254, "Значение слишком длинное."),
  password: z
    .string()
    .min(1, "Введите пароль.")
    .max(128, "Пароль слишком длинный."),
});

const verifyEmailSchema = z.object({
  token: z.string().trim().min(32, "Некорректная ссылка подтверждения."),
});

function verificationTtlHours(): number {
  const value = Number(process.env.EMAIL_VERIFICATION_TTL_HOURS ?? "24");
  return Number.isFinite(value) && value > 0 ? value : 24;
}

function publicAppBaseUrl(req: express.Request): string {
  const configuredUrl = process.env.APP_PUBLIC_URL?.trim();
  const origin = req.get("origin");

  return (configuredUrl || origin || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

function buildVerificationUrl(req: express.Request, token: string): string {
  const baseUrl = publicAppBaseUrl(req);
  return `${baseUrl}/auth/verify?token=${encodeURIComponent(token)}`;
}

function formatZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Некорректные данные формы.";
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

async function createVerificationTokenAndSendEmail(params: {
  req: express.Request;
  userId: string;
  username: string;
  email: string;
}): Promise<void> {
  const token = generateSecretToken();
  const expiresAt = addHours(new Date(), verificationTtlHours());

  await createEmailVerificationToken({
    userId: params.userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  await sendVerificationEmail({
    to: params.email,
    username: params.username,
    verifyUrl: buildVerificationUrl(params.req, token),
  });
}

export function createAuthRouter(): express.Router {
  const router = express.Router();

  router.post("/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: formatZodError(parsed.error) });
      return;
    }

    try {
      const passwordHash = await hashPassword(parsed.data.password);
      const user = await createUser({
        username: parsed.data.username,
        email: parsed.data.email,
        passwordHash,
      });

      await createVerificationTokenAndSendEmail({
        req,
        userId: user.id,
        username: user.username,
        email: user.email,
      });

      await createSessionCookieForUser(res, user.id);

      res.status(201).json({
        user,
        message: "Аккаунт создан. Мы отправили ссылку подтверждения на почту.",
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "Такой логин или почта уже заняты." });
        return;
      }

      console.error("REGISTER ERROR:", error);
      res.status(500).json({ error: "Не удалось создать аккаунт." });
    }
  });

  router.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: formatZodError(parsed.error) });
      return;
    }

    try {
      const userRow = await findUserByLogin(parsed.data.login);
      const passwordOk = userRow
        ? await verifyPassword(parsed.data.password, userRow.password_hash)
        : false;

      if (!userRow || !passwordOk) {
        res.status(401).json({ error: "Неверный логин, почта или пароль." });
        return;
      }

      await deleteExpiredAuthSessions();
      await createSessionCookieForUser(res, userRow.id);

      res.json({
        user: {
          id: userRow.id,
          username: userRow.username,
          email: userRow.email,
          emailVerified: userRow.email_verified,
          createdAt: userRow.created_at.toISOString(),
        },
      });
    } catch (error) {
      console.error("LOGIN ERROR:", error);
      res.status(500).json({ error: "Не удалось войти в аккаунт." });
    }
  });

  router.post("/logout", async (req, res) => {
    try {
      await clearSessionCookie(req, res);
      res.json({ ok: true });
    } catch (error) {
      console.error("LOGOUT ERROR:", error);
      res.status(500).json({ error: "Не удалось выйти из аккаунта." });
    }
  });

  router.get("/me", async (req, res) => {
    try {
      const user = await getRequestUser(req);

      if (!user) {
        res.json({ user: null });
        return;
      }

      res.json({ user });
    } catch (error) {
      console.error("ME ERROR:", error);
      res.status(500).json({ error: "Не удалось проверить аккаунт." });
    }
  });

  router.post("/verify-email", async (req, res) => {
    const parsed = verifyEmailSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: formatZodError(parsed.error) });
      return;
    }

    try {
      const user = await consumeEmailVerificationToken(hashToken(parsed.data.token));

      if (!user) {
        res.status(400).json({
          error: "Ссылка подтверждения устарела или уже была использована.",
        });
        return;
      }

      await createSessionCookieForUser(res, user.id);
      res.json({ user, message: "Почта подтверждена." });
    } catch (error) {
      console.error("VERIFY EMAIL ERROR:", error);
      res.status(500).json({ error: "Не удалось подтвердить почту." });
    }
  });

  router.post("/resend-verification", requireAuth, async (req, res) => {
    const user = res.locals.authUser as AuthUser;

    if (user.emailVerified) {
      res.json({ user, message: "Почта уже подтверждена." });
      return;
    }

    try {
      await createVerificationTokenAndSendEmail({
        req,
        userId: user.id,
        username: user.username,
        email: user.email,
      });

      res.json({ user, message: "Новая ссылка подтверждения отправлена." });
    } catch (error) {
      console.error("RESEND VERIFICATION ERROR:", error);
      res.status(500).json({ error: "Не удалось отправить письмо подтверждения." });
    }
  });

  return router;
}
