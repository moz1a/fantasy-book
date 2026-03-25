import { pool } from "./db.js";
import { type GameState } from "../game/types.js";

export async function loadSession(sessionId: string): Promise<GameState | null> {
  const result = await pool.query(
    `
      SELECT state_json
      FROM sessions
      WHERE id = $1
    `,
    [sessionId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].state_json as GameState;
}

export async function upsertSession(state: GameState): Promise<void> {
  await pool.query(
    `
      INSERT INTO sessions (id, state_json, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (id) DO UPDATE SET
        state_json = EXCLUDED.state_json,
        updated_at = NOW()
    `,
    [state.sessionId, state]
  );
}

















// import { db } from "./db.js";
// import { type GameState } from "../game/types.js";

// export function loadSession(sessionId: string): GameState | null {
//   const row = db
//     .prepare("SELECT state_json FROM sessions WHERE id = ?")
//     .get(sessionId) as { state_json: string } | undefined;

//   if (!row) return null;

//   try {
//     return JSON.parse(row.state_json) as GameState;
//   } catch {
//     return null;
//   }
// }

// export function upsertSession(state: GameState) {
//   db.prepare(`
//     INSERT INTO sessions (id, state_json)
//     VALUES (?, ?)
//     ON CONFLICT(id) DO UPDATE SET
//       state_json = excluded.state_json
//   `).run(state.sessionId, JSON.stringify(state));
// }
