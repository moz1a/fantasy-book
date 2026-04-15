import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";

import "dotenv/config";

import {
  createNewState,
  type CombatPatch,
  type DirectorPatch,
  type GameState,
  type Patch,
} from "./game/types.js";

import {
  attachSessionToUser,
  loadSession,
  SessionAccessError,
  upsertCharacterPortrait,
  upsertSession,
  upsertTurnIllustration,
} from "./db/sessionsRepo.js";

import { initDb } from "./db/db.js";
import { createAuthRouter } from "./auth/routes.js";
import { requireAuth } from "./auth/session.js";
import type { AuthUser } from "./auth/repo.js";
import { gmReplySchema } from "./game/gmSchema.js";
import { elizaChat } from "./llm/llmEliza.js";

import {
  generateCharacterPortrait,
  generateSceneIllustration,
} from "./llm/yandexArt.js";
import { parseAndNormalizeModelJson } from "./game/normalization.js";

const app = express();

const allowedOrigins = (
  process.env.CORS_ORIGINS ??
  process.env.APP_PUBLIC_URL ??
  "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  })
);
app.use(express.json());
app.use("/auth", createAuthRouter());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/session/:id", requireAuth, async (req, res) => {
  try {
    const sessionId = String(req.params.id);
    const authUser = res.locals.authUser as AuthUser;
    const state = await loadSession(sessionId, authUser.id);

    if (!state) {
      res.status(404).json({ error: "session not found", sessionId });
      return;
    }

    res.json({ state });
  } catch (e: unknown) {
    if (e instanceof SessionAccessError) {
      res.status(403).json({ error: "Эта игровая сессия принадлежит другому аккаунту." });
      return;
    }

    console.error("SESSION LOAD ERROR:", e);
    const message = e instanceof Error ? e.message : "server error";
    res.status(500).json({ error: message });
  }
});

function formatPlayerForPrompt(player: GameState["player"]): string {
  return JSON.stringify({
    name: player.name,
    hp: player.hp,
    maxHp: player.maxHp,
    gold: player.gold,
    location: player.location,
    inventory: player.inventory,
    stats: player.stats,
    effects: player.effects,
  }, null, 2);
}

function normalizeStatsPatch(stats: Patch["stats"]): Patch["stats"] {
  if (!stats) return undefined;

  const normalized: NonNullable<Patch["stats"]> = {};

  if (typeof stats.strength === "number") {
    normalized.strength = stats.strength;
  }

  if (typeof stats.agility === "number") {
    normalized.agility = stats.agility;
  }

  if (typeof stats.intelligence === "number") {
    normalized.intelligence = stats.intelligence;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeCombatPatch(combatPatch: CombatPatch | undefined): CombatPatch | undefined {
  if (!combatPatch) return undefined;

  const normalized: CombatPatch = {};

  if (typeof combatPatch.active === "boolean") {
    normalized.active = combatPatch.active;
  }
  if (typeof combatPatch.enemyName === "string" && combatPatch.enemyName.trim()) {
    normalized.enemyName = combatPatch.enemyName.trim();
  }
  if (typeof combatPatch.enemyHp === "number") {
    normalized.enemyHp = combatPatch.enemyHp;
  }
  if (typeof combatPatch.enemyMaxHp === "number") {
    normalized.enemyMaxHp = combatPatch.enemyMaxHp;
  }
  if (typeof combatPatch.enemyIntent === "string" && combatPatch.enemyIntent.trim()) {
    normalized.enemyIntent = combatPatch.enemyIntent.trim();
  }
  if (combatPatch.distance) {
    normalized.distance = combatPatch.distance;
  }
  if (combatPatch.phase) {
    normalized.phase = combatPatch.phase;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeDirectorPatch(directorPatch: DirectorPatch | undefined): DirectorPatch | undefined {
  if (!directorPatch) return undefined;

  const normalized: DirectorPatch = {};

  if (directorPatch.sceneKind) {
    normalized.sceneKind = directorPatch.sceneKind;
  }
  if (typeof directorPatch.sceneGoal === "string" && directorPatch.sceneGoal.trim()) {
    normalized.sceneGoal = directorPatch.sceneGoal.trim();
  }
  if (typeof directorPatch.tension === "number") {
    normalized.tension = directorPatch.tension;
  }
  if (typeof directorPatch.lastMajorEventTurn === "number") {
    normalized.lastMajorEventTurn = directorPatch.lastMajorEventTurn;
  }
  if (typeof directorPatch.lastCombatTurn === "number") {
    normalized.lastCombatTurn = directorPatch.lastCombatTurn;
  }
  if (typeof directorPatch.stallCount === "number") {
    normalized.stallCount = directorPatch.stallCount;
  }
  if (directorPatch.addThreads?.length) {
    normalized.addThreads = directorPatch.addThreads;
  }
  if (directorPatch.removeThreads?.length) {
    normalized.removeThreads = directorPatch.removeThreads;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function isPlayerPatchMeaningful(patch: Patch): boolean {
  return Boolean(
    patch.hp !== undefined ||
      patch.maxHp !== undefined ||
      patch.gold !== undefined ||
      patch.location !== undefined ||
      patch.stats !== undefined ||
      patch.addItems?.length ||
      patch.removeItems?.length ||
      patch.addEffects?.length ||
      patch.removeEffects?.length
  );
}

function isCombatPatchMeaningful(combatPatch: CombatPatch | undefined): boolean {
  return Boolean(combatPatch && Object.keys(combatPatch).length > 0);
}

function normalizeChoiceText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function choicesTooSimilar(choices: Array<{ text: string }>) {
  const normalized = choices.map((c) => normalizeChoiceText(c.text));
  return new Set(normalized).size < 3;
}

app.post("/turn", requireAuth, async (req, res) => {
  try {
    const authUser = res.locals.authUser as AuthUser;
    const sessionId: string = req.body?.sessionId ?? randomUUID();
    const action: string = String(req.body?.action ?? "").trim();

    if (!action) {
      res.status(400).json({ error: "action is required", sessionId });
      return;
    }

    let state: GameState = (await loadSession(sessionId, authUser.id)) ?? createNewState(sessionId);

    const pacing = buildPacingFlags(state);

    const recent = state.turns
      .slice(-5)
      .map((t, i) => {
        return [
          `Ход ${state.director.turnNumber - (Math.min(5, state.turns.length) - 1) + i}:`,
          `Действие игрока: ${t.action}`,
          `Ответ мастера: ${t.narrative}`,
          `PlayerPatch: ${JSON.stringify(t.patch)}`,
          `CombatPatch: ${JSON.stringify(t.combatPatch ?? {})}`,
          `DirectorPatch: ${JSON.stringify(t.directorPatch ?? {})}`,
        ].join("\n");
      })
      .join("\n\n");

    const user = [
      `Текущее worldSummary: ${state.worldSummary}`,
      `Игрок: ${formatPlayerForPrompt(state.player)}`,
      `Director: ${JSON.stringify(state.director, null, 2)}`,
      `Combat: ${JSON.stringify(state.combat, null, 2)}`,
      `Pacing: ${JSON.stringify(pacing, null, 2)}`,
      "Последние события:",
      recent || "Это начало приключения.",
      "Последнее действие игрока:",
      action,
      "Сгенерируй следующий ход по правилам.",
    ].join("\n\n");

    const system = [
      "Ты — ИИ-мастер динамичной интерактивной фэнтези-игры.",
      "Твоя цель — создавать плотный темп, яркие последствия и разнообразные ситуации.",
      "Верни только валидный JSON по схеме.",
      "Без markdown и без текста вне JSON.",
      "Структура ответа строго: narrative, prompt, choices, worldSummary, patch, combatPatch, directorPatch.",

      "Главные правила геймплея:",
      "1. Каждый ход должен давать НОВЫЙ РЕЗУЛЬТАТ действия игрока, а не повторять ту же ситуацию другими словами.",
      "2. Мир обязан явно реагировать на действие игрока в этом же ходу.",
      "3. Нельзя держать одну и ту же фазу сцены более 2 ходов подряд.",
      "4. Если forceMajorEvent=true, в этом ходу обязан случиться крупный сдвиг: нападение, откровение, ловушка, предательство, находка, смена локации, окно для побега или союз.",
      "5. Если идет бой, в каждом ходе боя должно измениться хотя бы одно значимое состояние: hp игрока, hp врага, дистанция, эффект, позиция или контроль над сценой.",
      "6. Сражения должны быть короче и напряжённее: обычная схватка длится 2-4 хода, а не бесконечно.",
      "7. Учитывай характеристики игрока: strength — силовые действия; agility — уклонение, скорость, точность; intelligence — анализ, хитрость, древние знания, магические символы.",
      "8. Плохие рискованные решения могут снижать hp или накладывать effects.",
      "9. Еда, отдых, удачное лечение и безопасная передышка могут восстанавливать hp и снимать effects.",
      "10. choices должны быть тремя РАЗНЫМИ тактиками, а не перефразировками одного и того же.",
      "11. Хотя бы один choice должен быть смелым или неожиданным.",
      "12. Не предлагай choice вида 'продолжать делать то же самое', если он не меняет тактику или ситуацию.",
      "13. narrative: сначала результат действия игрока, затем реакция мира, затем новая опасность/возможность.",
      "14. prompt всегда: 'Что ты делаешь?'.",
      "15. narrative — 2-4 коротких абзаца.",
      "16. В choices должно быть ровно 3 варианта.",
      "17. Каждый choice: {id, text}. id: ^[a-z0-9_-]+$.",
      "18. combatPatch и directorPatch всегда должны присутствовать как объекты, даже если они пустые.",
      "19. Если forceCombat=true и ситуация допускает столкновение, начни бой или засаду в этом ходу.",
      "20. Если бой начался или продолжается, обязательно меняй combatPatch.",
      "21. Если произошёл крупный поворот, укажи directorPatch.lastMajorEventTurn = Pacing.nextTurn.",
      "22. Если сцена сменила тип, укажи directorPatch.sceneKind и directorPatch.sceneGoal.",
      "23. Не оставляй patch, combatPatch и directorPatch одновременно пустыми два хода подряд.",
      "24. choices должны представлять 3 разные тактики: прямое действие, осторожное действие, хитрое/неожиданное действие.",
      "25. При начале обычного боя старайся задавать врагу enemyHp и enemyMaxHp, а phase ставь opening/exchange/finisher.",
      "26. Если герой физически перешёл в новое место, комнату, зал, улицу, коридор, этаж или иную явно новую зону, обязательно укажи новую локацию в patch.location.",
      "27. Если локация не изменилась физически, не меняй patch.location.",
      "28. Если герой получил или потерял новый предмет инвентаря или эффект состояния, обязательно указывай это в addItems, removeItems, addEffects, removeEffects",

      "patch может содержать только поля: hp, maxHp, gold, location, stats, addItems, removeItems, addEffects, removeEffects.",
      "Поле stats может содержать только: strength, agility, intelligence.",
      "Не добавляй в patch других полей.",
      "Если изменений нет, верни patch как {}.",
    ].join("\n\n");

    const llm = await elizaChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.5,
      max_tokens: 600,
    });

    if (typeof llm.content !== "string" || !llm.content.trim()) {
      res.status(502).json({ error: "LLM returned empty or invalid content" });
      return;
    }

    let normalizedText: string;
    let normalizedObject: unknown;

    try {
      const result = parseAndNormalizeModelJson(llm.content);
      normalizedText = result.normalizedText;
      normalizedObject = result.normalizedObject;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to parse model JSON";
      res.status(502).json({
        error: message,
        rawContent: llm.content,
      });
      return;
    }

    const validation = gmReplySchema.safeParse(normalizedObject);

    if (!validation.success) {
      res.status(502).json({
        error: "LLM response does not match gmReplySchema",
        details: validation.error.issues,
        rawContent: llm.content,
        normalizedText,
        normalizedObject,
      });
      return;
    }

    const gm = validation.data;

    if (choicesTooSimilar(gm.choices)) {
      res.status(502).json({
        error: "LLM returned too similar choices",
        choices: gm.choices,
      });
      return;
    }

    const patch: Patch = {
      ...gm.patch,
      stats: normalizeStatsPatch(gm.patch?.stats),
    };

    const combatPatch = normalizeCombatPatch(gm.combatPatch);
    const directorPatch = normalizeDirectorPatch(gm.directorPatch);

    const inv = new Set(state.player.inventory);
    for (const it of patch.addItems ?? []) inv.add(it);
    for (const it of patch.removeItems ?? []) inv.delete(it);

    const effects = new Set(state.player.effects);
    for (const effect of patch.addEffects ?? []) effects.add(effect);
    for (const effect of patch.removeEffects ?? []) effects.delete(effect);

    const nextStats = {
      strength: patch.stats?.strength ?? state.player.stats.strength,
      agility: patch.stats?.agility ?? state.player.stats.agility,
      intelligence: patch.stats?.intelligence ?? state.player.stats.intelligence,
    };

    const nextMaxHp = Math.max(1, patch.maxHp ?? state.player.maxHp);
    const nextHpRaw = patch.hp ?? state.player.hp;
    const nextHp = Math.max(0, Math.min(nextHpRaw, nextMaxHp));

    const turn = {
      id: randomUUID(),
      at: Date.now(),
      action,
      narrative: gm.narrative,
      prompt: gm.prompt,
      choices: gm.choices,
      worldSummary: gm.worldSummary,
      patch,
      combatPatch,
      directorPatch,
    };
    const nextTurnNumber = state.director.turnNumber + 1;

    const nextEnemyMaxHp =
      typeof (combatPatch?.enemyMaxHp ?? state.combat.enemyMaxHp) === "number"
        ? Math.max(1, combatPatch?.enemyMaxHp ?? state.combat.enemyMaxHp ?? 1)
        : undefined;

    const rawEnemyHp = combatPatch?.enemyHp ?? state.combat.enemyHp;
    const nextEnemyHp =
      typeof rawEnemyHp === "number"
        ? clamp(rawEnemyHp, 0, nextEnemyMaxHp ?? 999)
        : undefined;

    const combatActive = combatPatch?.active ?? state.combat.active;

    const nextCombat = combatActive
      ? {
          active: true,
          enemyName: combatPatch?.enemyName ?? state.combat.enemyName,
          enemyHp: nextEnemyHp,
          enemyMaxHp: nextEnemyMaxHp,
          enemyIntent: combatPatch?.enemyIntent ?? state.combat.enemyIntent,
          distance: combatPatch?.distance ?? state.combat.distance,
          phase: combatPatch?.phase ?? state.combat.phase,
        }
      : {
          active: false,
        };

    const threads = new Set(state.director.unresolvedThreads);
    for (const thread of directorPatch?.addThreads ?? []) threads.add(thread);
    for (const thread of directorPatch?.removeThreads ?? []) threads.delete(thread);

    const meaningfulProgress =
      isPlayerPatchMeaningful(patch) ||
      isCombatPatchMeaningful(combatPatch) ||
      Boolean(directorPatch?.sceneKind) ||
      Boolean(directorPatch?.sceneGoal) ||
      Boolean(directorPatch?.addThreads?.length) ||
      Boolean(directorPatch?.removeThreads?.length);

    const nextDirector = {
      ...state.director,
      turnNumber: nextTurnNumber,
      sceneKind: directorPatch?.sceneKind ?? (combatActive ? "combat" : state.director.sceneKind),
      sceneGoal: directorPatch?.sceneGoal ?? state.director.sceneGoal,
      tension: clamp(
        directorPatch?.tension ??
          state.director.tension + (combatActive ? 12 : pacing.forceMajorEvent ? 8 : 3),
        0,
        100
      ),
      lastMajorEventTurn:
        directorPatch?.lastMajorEventTurn ??
        (pacing.forceMajorEvent || isCombatPatchMeaningful(combatPatch)
          ? nextTurnNumber
          : state.director.lastMajorEventTurn),
      lastCombatTurn:
        directorPatch?.lastCombatTurn ??
        (combatActive ? nextTurnNumber : state.director.lastCombatTurn),
      stallCount:
        directorPatch?.stallCount ??
        (meaningfulProgress ? 0 : state.director.stallCount + 1),
      unresolvedThreads: Array.from(threads),
    };

    state = {
      ...state,
      worldSummary: gm.worldSummary,
      player: {
        ...state.player,
        hp: nextHp,
        maxHp: nextMaxHp,
        gold: patch.gold ?? state.player.gold,
        location: patch.location ?? state.player.location,
        stats: nextStats,
        inventory: Array.from(inv),
        effects: Array.from(effects),
      },
      director: nextDirector,
      combat: nextCombat,
      turns: [...state.turns, turn],
    };

    await upsertSession(state, authUser?.id);
    res.json({ state });
  } catch (e: unknown) {
    if (e instanceof SessionAccessError) {
      res.status(403).json({ error: "Эта игровая сессия принадлежит другому аккаунту." });
      return;
    }

    console.error("TURN ERROR:", e);
    const message = e instanceof Error ? e.message : "server error";
    res.status(500).json({ error: message });
  }
});

app.post("/session", requireAuth, async (_req, res) => {
  const authUser = res.locals.authUser as AuthUser;
  const sessionId = randomUUID();
  const state = createNewState(sessionId);

  await upsertSession(state, authUser?.id);

  res.json({ state });
});

app.post("/session/:id/claim", requireAuth, async (req, res) => {
  const sessionId = String(req.params.id);
  const authUser = res.locals.authUser as AuthUser;

  try {
    const attached = await attachSessionToUser(sessionId, authUser.id);
    if (!attached) {
      res.status(404).json({ error: "session not found or unavailable", sessionId });
      return;
    }

    const state = await loadSession(sessionId, authUser.id);

    if (!state) {
      res.status(404).json({ error: "session not found", sessionId });
      return;
    }

    res.json({ state });
  } catch (e: unknown) {
    if (e instanceof SessionAccessError) {
      res.status(403).json({ error: "Эта игровая сессия принадлежит другому аккаунту." });
      return;
    }

    console.error("SESSION CLAIM ERROR:", e);
    const message = e instanceof Error ? e.message : "server error";
    res.status(500).json({ error: message });
  }
});

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);

  if (!match || !match[1] || !match[2]) {
    throw new Error("Invalid data URL returned by illustration generator");
  }

  const [, mimeType, base64] = match;

  return {
    mimeType,
    base64,
  };
}

app.post("/illustration", requireAuth, async (req, res) => {
  try {
    const authUser = res.locals.authUser as AuthUser;
    const sessionId = String(req.body?.sessionId ?? "").trim();
    const turnId = String(req.body?.turnId ?? "").trim();

    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const state = await loadSession(sessionId, authUser.id);

    if (!state) {
      res.status(404).json({ error: "session not found", sessionId });
      return;
    }

    await attachSessionToUser(sessionId, authUser.id);

    const turn =
      state.turns.find((t) => t.id === turnId) ??
      state.turns[state.turns.length - 1];

    if (!turn) {
      res.status(404).json({ error: "turn not found" });
      return;
    }

    const imageUrl = await generateSceneIllustration({
      narrative: turn.narrative,
      worldSummary: state.worldSummary,
      location: state.player.location,
    });

    const { mimeType, base64 } = parseDataUrl(imageUrl);

    await upsertTurnIllustration({
      sessionId,
      turnId: turn.id,
      mimeType,
      imageBase64: base64,
    });

    const updatedState = await loadSession(sessionId);

    if (!updatedState) {
      res.status(500).json({ error: "failed to reload session after saving illustration" });
      return;
    }

    res.json({
      state: updatedState,
      turnId: turn.id,
      imageUrl,
    });
  } catch (e: unknown) {
    if (e instanceof SessionAccessError) {
      res.status(403).json({ error: "Эта игровая сессия принадлежит другому аккаунту." });
      return;
    }

    console.error("ILLUSTRATION ERROR:", e);
    const message = e instanceof Error ? e.message : "server error";
    res.status(500).json({ error: message });
  }
});

app.post("/character/avatar", requireAuth, async (req, res) => {
  try {
    const authUser = res.locals.authUser as AuthUser;
    const sessionId = String(req.body?.sessionId ?? "").trim();

    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const state = await loadSession(sessionId, authUser.id);

    if (!state) {
      res.status(404).json({ error: "session not found", sessionId });
      return;
    }

    await attachSessionToUser(sessionId, authUser.id);

    const portraitDescription = [
      `Имя героя: ${state.player.name}.`,
      `Здоровье: ${state.player.hp}/${state.player.maxHp}.`,
      `Инвентарь: ${state.player.inventory.length ? state.player.inventory.join(", ") : "пусто"}.`,
      `Характеристики: сила ${state.player.stats.strength}, ловкость ${state.player.stats.agility}, интеллект ${state.player.stats.intelligence}.`,
      state.player.effects.length
        ? `Состояния: ${state.player.effects.join(", ")}.`
        : "Состояний нет.",
    ].join(" ");

const imageUrl = await generateCharacterPortrait({
  description: portraitDescription,
});

    const { mimeType, base64 } = parseDataUrl(imageUrl);

    await upsertCharacterPortrait({
      sessionId,
      mimeType,
      imageBase64: base64,
    });

    const updatedState = await loadSession(sessionId);

    if (!updatedState) {
      res.status(500).json({ error: "failed to reload session after saving character portrait" });
      return;
    }

    res.json({
      state: updatedState,
      imageUrl,
    });
  } catch (e: unknown) {
    if (e instanceof SessionAccessError) {
      res.status(403).json({ error: "Эта игровая сессия принадлежит другому аккаунту." });
      return;
    }

    console.error("CHARACTER AVATAR ERROR:", e);
    const message = e instanceof Error ? e.message : "server error";
    res.status(500).json({ error: message });
  }
});

function buildPacingFlags(state: GameState) {
  const nextTurn = state.director.turnNumber + 1;
  const turnsSinceMajorEvent = nextTurn - state.director.lastMajorEventTurn;
  const turnsSinceCombat = nextTurn - state.director.lastCombatTurn;

  return {
    nextTurn,
    forceMajorEvent: turnsSinceMajorEvent >= 4,
    forceCombat:
      !state.combat.active &&
      turnsSinceCombat >= 5 &&
      state.player.hp > 2,
    forceResolution:
      state.combat.active && state.combat.phase === "exchange",
  };
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

async function bootstrap() {
  await initDb();

  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
