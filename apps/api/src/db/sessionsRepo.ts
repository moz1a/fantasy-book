import { db } from "./db.js";
import type { GameState } from "../game/types.js";

export function loadSession(sessionId: string): GameState | null {
  const row = db
    .prepare("SELECT state_json FROM sessions WHERE id = ?")
    .get(sessionId) as { state_json: string } | undefined;

  return row ? (JSON.parse(row.state_json) as GameState) : null;
}

export function upsertSession(state: GameState) {
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO sessions (id, state_json, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
  `).run(state.sessionId, JSON.stringify(state), now, now);
}