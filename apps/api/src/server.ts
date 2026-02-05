import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";

import { createNewState, type GameState } from "./game/types.js";
import { loadSession, upsertSession } from "./db/sessionsRepo.js";

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

app.post("/turn", (req, res) => {
  const sessionId: string = req.body?.sessionId ?? randomUUID();
  const action: string = String(req.body?.action ?? "").trim();

  let state: GameState = loadSession(sessionId) ?? createNewState(sessionId);

  if (!action) {
    res.status(400).json({ error: "action is required", sessionId });
    return;
  }

  const now = new Date().toISOString();
  state = {
    ...state,
    log: [
      ...state.log,
      { at: now, role: "user", text: action },
      { at: now, role: "gm", text: `Пока без ИИ: ты сделал "${action}". История продолжается...` },
    ],
  };

  upsertSession(state);
  res.json({ state });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});