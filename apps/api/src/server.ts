import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";

import "dotenv/config";

import { createNewState, type GameState } from "./game/types.js";
import { loadSession, upsertSession } from "./db/sessionsRepo.js";
import { pplxChat } from "./llm/perplexity.js";
import { gmReplySchema } from "./game/gmSchema.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/session/:id", (req, res) => {
  const sessionId = String(req.params.id);
  const state = loadSession(sessionId);

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

    let state: GameState = loadSession(sessionId) ?? createNewState(sessionId);

    state = {
      ...state,
      log: [...state.log, { role: "user", text: action }],
    };

    const recent = state.log
      .slice(-3)
      .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
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

    const model = process.env.PPLX_MODEL ?? "sonar";
    const llm = await pplxChat({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
      max_tokens: 700,
    });

    console.log("LLM RAW CONTENT:", llm.content);

    let parsed: unknown;
    try {
      parsed = JSON.parse(llm.content);
    } catch {
      res.status(502).json({ error: "LLM returned invalid JSON" });
      return;
    }

    console.log("LLM PARSED CONTENT:", parsed);

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
    const patch = gm.patch ?? {};

    const inv = new Set(state.player.inventory);
    for (const it of patch.addItems ?? []) inv.add(it);
    for (const it of patch.removeItems ?? []) inv.delete(it);

    state = {
      ...state,
      worldSummary: gm.worldSummary,
      prompt: gm.prompt,
      choices: gm.choices,
      player: {
        ...state.player,
        hp: patch.hp ?? state.player.hp,
        gold: patch.gold ?? state.player.gold,
        location: patch.location ?? state.player.location,
        inventory: Array.from(inv),
      },
      log: [...state.log, { role: "gm", text: gm.narrative }],
    };

    upsertSession(state);
    res.json({ state });
  } catch (e: unknown) {
    console.error("TURN ERROR:", e);
    const message = e instanceof Error ? e.message : "server error";
    res.status(500).json({ error: message });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
