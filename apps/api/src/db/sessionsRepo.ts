import { pool } from "./db.js";
import { type GameState } from "../game/types.js";


type IllustrationRow = {
  turn_id: string;
  mime_type: string;
  image_base64: string;
};

function stripIllustrations(state: GameState): GameState {
  return {
    ...state,
    turns: state.turns.map(({ illustrationUrl, ...turn }) => turn),
  };
}

export async function loadSession(sessionId: string): Promise<GameState | null> {
  const sessionResult = await pool.query(
    `
      SELECT state_json
      FROM sessions
      WHERE id = $1
    `,
    [sessionId]
  );

  if (sessionResult.rows.length === 0) {
    return null;
  }

  const baseState = sessionResult.rows[0].state_json as GameState;

  const illustrationsResult = await pool.query<IllustrationRow>(
    `
      SELECT turn_id, mime_type, image_base64
      FROM turn_illustrations
      WHERE session_id = $1
    `,
    [sessionId]
  );

  const illustrationsMap = new Map(
    illustrationsResult.rows.map((row) => [
      row.turn_id,
      `data:${row.mime_type};base64,${row.image_base64}`,
    ])
  );

  return {
    ...baseState,
    turns: baseState.turns.map((turn) => {
      const illustrationUrl = illustrationsMap.get(turn.id);
      return illustrationUrl ? { ...turn, illustrationUrl } : turn;
    }),
  };
}

export async function upsertSession(state: GameState): Promise<void> {
  const stateWithoutIllustrations = stripIllustrations(state);

  await pool.query(
    `
      INSERT INTO sessions (id, state_json, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (id) DO UPDATE SET
        state_json = EXCLUDED.state_json,
        updated_at = NOW()
    `,
    [state.sessionId, stateWithoutIllustrations]
  );
}

export async function upsertTurnIllustration(params: {
  sessionId: string;
  turnId: string;
  mimeType: string;
  imageBase64: string;
}): Promise<void> {
  await pool.query(
    `
      INSERT INTO turn_illustrations (
        session_id,
        turn_id,
        mime_type,
        image_base64,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (session_id, turn_id) DO UPDATE SET
        mime_type = EXCLUDED.mime_type,
        image_base64 = EXCLUDED.image_base64,
        updated_at = NOW()
    `,
    [params.sessionId, params.turnId, params.mimeType, params.imageBase64]
  );
}