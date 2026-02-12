import { db } from "./db.js";
import { type GameState } from "../game/types.js";

export function loadSession(sessionId: string): GameState | null {
  const row = db
    .prepare("SELECT state_json FROM sessions WHERE id = ?")
    .get(sessionId) as { state_json: string } | undefined;

  if (!row) return null;

  try {
    return JSON.parse(row.state_json) as GameState;
  } catch {
    return null;
  }
}

export function upsertSession(state: GameState) {
  db.prepare(`
    INSERT INTO sessions (id, state_json)
    VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET
      state_json = excluded.state_json
  `).run(state.sessionId, JSON.stringify(state));
}
