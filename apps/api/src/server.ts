import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";

import "dotenv/config";

import { createNewState, type GameState, type Patch } from "./game/types.js";
import {
  loadSession,
  upsertSession,
  upsertTurnIllustration,
} from "./db/sessionsRepo.js";

import { initDb } from "./db/db.js";
//import { llmChat } from "./llm/llmConnection.js";
//import { cloudChat } from "./llm/llmCloud.js";
import { gmReplySchema } from "./game/gmSchema.js";
import { elizaChat } from "./llm/llmEliza.js";

import { generateSceneIllustration } from "./llm/yandexArt.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/session/:id", async (req, res) => {
  const sessionId = String(req.params.id);
  const state = await loadSession(sessionId);

  if (!state) {
    res.status(404).json({ error: "session not found", sessionId });
    return;
  }

  res.json({ state });
});

app.post("/turn", async (req, res) => {
  try {
    const sessionId: string = req.body?.sessionId ?? randomUUID();
    const action: string = String(req.body?.action ?? "").trim();

    if (!action) {
      res.status(400).json({ error: "action is required", sessionId });
      return;
    }

    let state: GameState = (await loadSession(sessionId)) ?? createNewState(sessionId);

    const recent = state.turns
      .slice(-3)
      .map((t) => `USER: ${t.action}\n\nGM: ${t.narrative}`)
      .join("\n\n");

    const system = [
      "Ты — ИИ-мастер интерактивной фэнтези-игры.",
      "Верни только валидный JSON по схеме.",
      "Без markdown и без текста вне JSON.",
      "Структура ответа строго: narrative, prompt, choices, worldSummary, patch.",
      "В choices должно быть ровно 3 варианта.",
      "prompt всегда: 'Что ты делаешь?'.",
      "narrative — 2-4 коротких абзаца.",
      "Каждый choice: {id, text}. id: ^[a-z0-9_-]+$.",
      "patch меняет только то, что реально изменилось в этом ходе.",
    ].join("\n");

    const user = [
      `Текущее worldSummary: ${state.worldSummary}`,
      `Игрок: name=${state.player.name}, hp=${state.player.hp}, gold=${state.player.gold}, location=${state.player.location}, inventory=[${state.player.inventory.join(", ")}]`,
      "Последние события:",
      recent,
      "Последнее действие игрока:",
      action,
      "Сгенерируй следующий ход по указанным правилам.",
    ].join("\n\n");

    const llm = await elizaChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.5,
      max_tokens: 500,
    });

    let parsed: unknown;

    if (typeof llm.content !== "string") {
      res.status(502).json({ error: "LLM returned empty or invalid content" });
      return;
    }

    try {
      parsed = JSON.parse(llm.content);
    } catch {
      res.status(502).json({ error: "LLM returned invalid JSON" });
      return;
    }

    const validation = gmReplySchema.safeParse(parsed);
    if (!validation.success) {
      res.status(502).json({
        error: "LLM response does not match gmReplySchema",
        details: validation.error.issues,
      });
      return;
    }

    console.log("VALIDATION", validation.data);

    const gm = validation.data;
    const patch: Patch = gm.patch ?? {};

    const inv = new Set(state.player.inventory);
    for (const it of patch.addItems ?? []) inv.add(it);
    for (const it of patch.removeItems ?? []) inv.delete(it);

    const turn = {
      id: randomUUID(),
      at: Date.now(),
      action,
      narrative: gm.narrative,
      prompt: gm.prompt,
      choices: gm.choices,
      worldSummary: gm.worldSummary,
      patch,
    };

    state = {
      ...state,
      worldSummary: gm.worldSummary,
      player: {
        ...state.player,
        hp: patch.hp ?? state.player.hp,
        gold: patch.gold ?? state.player.gold,
        location: patch.location ?? state.player.location,
        inventory: Array.from(inv),
      },
      turns: [...state.turns, turn],
    };

    await upsertSession(state);
    res.json({ state });
  } catch (e: unknown) {
    console.error("TURN ERROR:", e);
    const message = e instanceof Error ? e.message : "server error";
    res.status(500).json({ error: message });
  }
});

app.post("/session", async (_req, res) => {
  const sessionId = randomUUID();
  const state = createNewState(sessionId);

  await upsertSession(state);

  res.json({ state });
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

app.post("/illustration", async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId ?? "").trim();
    const turnId = String(req.body?.turnId ?? "").trim();

    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const state = await loadSession(sessionId);

    if (!state) {
      res.status(404).json({ error: "session not found", sessionId });
      return;
    }

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
    console.error("ILLUSTRATION ERROR:", e);
    const message = e instanceof Error ? e.message : "server error";
    res.status(500).json({ error: message });
  }
});

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