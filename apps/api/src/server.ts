import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";

import { createNewState, type GameState } from "./game/types.js";
import { loadSession, upsertSession } from "./db/sessionsRepo.js";

import "dotenv/config";
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

// app.post("/turn", (req, res) => {
//   const sessionId: string = req.body?.sessionId ?? randomUUID();
//   const action: string = String(req.body?.action ?? "").trim();

//   let state: GameState = loadSession(sessionId) ?? createNewState(sessionId);

//   if (!action) {
//     res.status(400).json({ error: "action is required", sessionId });
//     return;
//   }

//   const now = new Date().toISOString();
//   state = {
//     ...state,
//     log: [
//       ...state.log,
//       { at: now, role: "user", text: action },
//       { at: now, role: "gm", text: `Пока без ИИ: ты сделал "${action}". История продолжается...` },
//     ],
//   };

//   upsertSession(state);
//   res.json({ state });
// });

app.post("/turn", async (req, res) => {
  try {
    const sessionId: string = req.body?.sessionId ?? randomUUID();
    const action: string = String(req.body?.action ?? "").trim();

    let state: GameState = loadSession(sessionId) ?? createNewState(sessionId);

    if (!action) {
      res.status(400).json({ error: "action is required", sessionId });
      return;
    }

    const now = new Date().toISOString();

    // 1) Добавляем действие игрока в лог
    state = {
      ...state,
      log: [...state.log, { at: now, role: "user", text: action }],
    };

    // 2) Формируем контекст для модели (держим коротким)
    const recent = state.log.slice(-12).map((m) => `${m.role.toUpperCase()}: ${m.text}`).join("\n\n");

    const system = [
      "Ты — ИИ-рассказчик (game master) интерактивной фэнтези-книги.",
      "Всегда возвращай СТРОГО валидный JSON без markdown и без пояснений.",
      "Стиль: короткие игровые ходы, без лирики и повторов. Не повторяй названия/описания, если они уже в worldSummary/scene.",
      "Не противоречь worldSummary и логам. Если не хватает данных — уточни в narrative.",
      "narrative: 2–4 коротких абзаца, максимум 1 яркая деталь на абзац, без перечислений характеристик.",
      "Всегда заканчивай вопросом 'Что ты делаешь?' или 2-3 краткими вариантами действий.",
      "patch: меняй только то, что реально изменилось в этом ходу.",
      "worldSummary: обновляй только если появились новые факты/квесты/персонажи; иначе слегка перефразируй и укороти.",
      "Не повторяй полные имена/титулы, если не происходит взаимодействия; используй местоимения или роль (капитан/лучник/пиратка)"
    ].join("\n");

    const user = [
      `Текущее worldSummary: ${state.worldSummary}`,
      `Текущее состояние игрока: name=${state.player.name}, hp=${state.player.hp}, gold=${state.player.gold}, location=${state.player.location}, inventory=[${state.player.inventory.join(", ")}]`,
      "Последние события:",
      recent,
      "Действие игрока (последнее):",
      action,
      "Сгенерируй следующий ход: narrative + обновлённый worldSummary + patch.",
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

    // 3) Парсим JSON от модели
    let parsed: unknown;
    try {
      parsed = JSON.parse(llm.content);
    } catch {
      // Если модель сорвалась и вернула не JSON — считаем это ошибкой хода
      res.status(502).json({ error: "LLM returned invalid JSON" });
      return;
    }

    const gm = gmReplySchema.parse(parsed);

    // 4) Применяем patch (минимально и безопасно)
    const patch = gm.patch ?? {};
    const nextHp = patch.hp ?? state.player.hp;
    const nextGold = patch.gold ?? state.player.gold;
    const nextLoc = patch.location ?? state.player.location;

    const inv = new Set(state.player.inventory);
    for (const it of patch.addItems ?? []) inv.add(it);
    for (const it of patch.removeItems ?? []) inv.delete(it);

    state = {
      ...state,
      worldSummary: gm.worldSummary,
      player: {
        ...state.player,
        hp: nextHp,
        gold: nextGold,
        location: nextLoc,
        inventory: Array.from(inv),
      },
      log: [...state.log, { at: new Date().toISOString(), role: "gm", text: gm.narrative }],
    };

    upsertSession(state);
    res.json({ state });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "server error" });
  }
});


const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});