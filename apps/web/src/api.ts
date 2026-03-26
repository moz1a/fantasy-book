type ApiError = { error?: string };

export type PlayerStats = {
  strength: number;
  agility: number;
  intelligence: number;
};

export type StatsPatch = {
  strength?: number | undefined;
  agility?: number | undefined;
  intelligence?: number | undefined;
};

export type PlayerState = {
  name: string;
  hp: number;
  maxHp: number;
  gold: number;
  inventory: string[];
  location: string;
  stats: PlayerStats;
  effects: string[];
  avatarUrl?: string | undefined;
};

export type Choice = {
  id: string;
  text: string;
};

export type Patch = {
  hp?: number | undefined;
  maxHp?: number | undefined;
  gold?: number | undefined;
  location?: string | undefined;
  stats?: StatsPatch | undefined;
  addItems?: string[] | undefined;
  removeItems?: string[] | undefined;
  addEffects?: string[] | undefined;
  removeEffects?: string[] | undefined;
};

export type Turn = {
  id: string;
  action: string;
  narrative: string;
  prompt: string;
  choices: Choice[];
  worldSummary: string;
  patch: Patch;
  illustrationUrl?: string | undefined;
};

export type GameState = {
  sessionId: string;
  worldSummary: string;
  player: PlayerState;
  turns: Turn[];
};

export type TurnResponse = { state: GameState };

export type IllustrationResponse = {
  state: GameState;
  turnId: string;
  imageUrl: string;
};

export type CharacterAvatarResponse = {
  state: GameState;
  imageUrl: string;
};

async function readJson(res: Response): Promise<unknown> {
  return await res.json();
}

function errorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as ApiError).error;
    if (typeof e === "string" && e.length) return e;
  }

  return fallback;
}

export async function getSession(sessionId: string) {
  const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}`);
  const data = await readJson(res);

  if (!res.ok) throw new Error(errorMessage(data, `HTTP ${res.status}`));
  return data as TurnResponse;
}

export async function postTurn(params: { sessionId?: string; action: string }) {
  const res = await fetch("/api/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await readJson(res);

  if (!res.ok) throw new Error(errorMessage(data, `HTTP ${res.status}`));
  return data as TurnResponse;
}

export async function createSession() {
  const res = await fetch("/api/session", {
    method: "POST",
  });

  const data = await readJson(res);

  if (!res.ok) throw new Error(errorMessage(data, `HTTP ${res.status}`));
  return data as TurnResponse;
}

export async function generateIllustration(params: {
  sessionId: string;
  turnId: string;
}) {
  const res = await fetch("/api/illustration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await readJson(res);

  if (!res.ok) {
    throw new Error(errorMessage(data, `HTTP ${res.status}`));
  }

  return data as IllustrationResponse;
}

export async function generateCharacterAvatar(params: {
  sessionId: string;
}) {
  const res = await fetch("/api/character/avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await readJson(res);

  if (!res.ok) {
    throw new Error(errorMessage(data, `HTTP ${res.status}`));
  }

  return data as CharacterAvatarResponse;
}