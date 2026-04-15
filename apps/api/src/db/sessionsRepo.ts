import { pool } from "./db.js";
import { createNewState, type GameState, type PlayerState } from "../game/types.js";

type IllustrationRow = {
  turn_id: string;
  mime_type: string;
  image_base64: string;
};

function normalizeState(raw: Partial<GameState>, sessionId: string): GameState {
  const base = createNewState(sessionId);

  return {
    ...base,
    ...raw,
    player: {
      ...base.player,
      ...(raw.player ?? {}),
      stats: {
        ...base.player.stats,
        ...(raw.player?.stats ?? {}),
      },
      inventory: Array.isArray(raw.player?.inventory)
        ? raw.player.inventory
        : base.player.inventory,
      effects: Array.isArray(raw.player?.effects)
        ? raw.player.effects
        : base.player.effects,
    },
    director: {
      ...base.director,
      ...(raw.director ?? {}),
      unresolvedThreads: Array.isArray(raw.director?.unresolvedThreads)
        ? raw.director.unresolvedThreads
        : base.director.unresolvedThreads,
    },
    combat: {
      ...base.combat,
      ...(raw.combat ?? {}),
    },
    turns: Array.isArray(raw.turns) ? raw.turns : [],
  };
}

type CharacterPortraitRow = {
  mime_type: string;
  image_base64: string;
};

function buildDataUrl(mimeType: string, imageBase64: string): string {
  return `data:${mimeType};base64,${imageBase64}`;
}

function normalizePlayer(player?: Partial<PlayerState>): PlayerState {
  const hp = typeof player?.hp === "number" ? player.hp : 10;
  const maxHp = typeof player?.maxHp === "number" ? player.maxHp : hp;

  return {
    name: typeof player?.name === "string" && player.name.trim()
      ? player.name
      : "Герой",
    hp,
    maxHp: Math.max(1, maxHp, hp),
    gold: typeof player?.gold === "number" ? player.gold : 0,
    inventory: Array.isArray(player?.inventory)
      ? player.inventory.filter((item): item is string => typeof item === "string")
      : [],
    location: typeof player?.location === "string" && player.location.trim()
      ? player.location
      : "Таверна",
    stats: {
      strength: typeof player?.stats?.strength === "number" ? player.stats.strength : 5,
      agility: typeof player?.stats?.agility === "number" ? player.stats.agility : 5,
      intelligence: typeof player?.stats?.intelligence === "number" ? player.stats.intelligence : 5,
    },
    effects: Array.isArray(player?.effects)
      ? player.effects.filter((item): item is string => typeof item === "string")
      : [],
    avatarUrl: typeof player?.avatarUrl === "string" ? player.avatarUrl : undefined,
  };
}

function stripTransientMedia(state: GameState): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      avatarUrl: undefined,
    },
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

  const baseState = normalizeState(
    sessionResult.rows[0].state_json as Partial<GameState>,
    sessionId
  );

  const illustrationsResult = await pool.query<IllustrationRow>(
    `
      SELECT turn_id, mime_type, image_base64
      FROM turn_illustrations
      WHERE session_id = $1
    `,
    [sessionId]
  );

  const portraitResult = await pool.query<CharacterPortraitRow>(
    `
      SELECT mime_type, image_base64
      FROM character_portraits
      WHERE session_id = $1
      LIMIT 1
    `,
    [sessionId]
  );

  const illustrationsMap = new Map(
    illustrationsResult.rows.map((row) => [
      row.turn_id,
      buildDataUrl(row.mime_type, row.image_base64),
    ])
  );

  const avatarUrl = portraitResult.rows[0]
    ? buildDataUrl(portraitResult.rows[0].mime_type, portraitResult.rows[0].image_base64)
    : undefined;

  return {
    ...baseState,
    player: avatarUrl
      ? { ...baseState.player, avatarUrl }
      : baseState.player,
    turns: baseState.turns.map((turn) => {
      const illustrationUrl = illustrationsMap.get(turn.id);
      return illustrationUrl ? { ...turn, illustrationUrl } : turn;
    }),
  };
}

export async function upsertSession(
  state: GameState,
  ownerUserId?: string | null
): Promise<void> {
  const stateWithoutMedia = stripTransientMedia(state);

  await pool.query(
    `
      INSERT INTO sessions (id, user_id, state_json, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (id) DO UPDATE SET
        state_json = EXCLUDED.state_json,
        user_id = COALESCE(sessions.user_id, EXCLUDED.user_id),
        updated_at = NOW()
    `,
    [state.sessionId, ownerUserId ?? null, stateWithoutMedia]
  );
}

export async function attachSessionToUser(
  sessionId: string,
  userId: string
): Promise<void> {
  await pool.query(
    `
      UPDATE sessions
      SET user_id = COALESCE(user_id, $2),
          updated_at = NOW()
      WHERE id = $1
    `,
    [sessionId, userId]
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

export async function upsertCharacterPortrait(params: {
  sessionId: string;
  mimeType: string;
  imageBase64: string;
}): Promise<void> {
  await pool.query(
    `
      INSERT INTO character_portraits (
        session_id,
        mime_type,
        image_base64,
        updated_at
      )
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (session_id) DO UPDATE SET
        mime_type = EXCLUDED.mime_type,
        image_base64 = EXCLUDED.image_base64,
        updated_at = NOW()
    `,
    [params.sessionId, params.mimeType, params.imageBase64]
  );
}
