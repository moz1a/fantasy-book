type ApiError = { error?: string };

export type PlayerState = {
  name: string;
  hp: number;
  gold: number;
  inventory: string[];
  location: string;
};

export type Choice = { id: string; text: string };

export type Patch = {
  hp?: number | undefined;
  gold?: number | undefined;
  location?: string | undefined;
  addItems?: string[] | undefined;
  removeItems?: string[] | undefined;
};

export type Turn = {
  id: string;
  action: string;
  narrative: string;
  prompt: string;
  choices: Choice[];
  worldSummary: string;
  patch: Patch;
};

export type GameState = {
  version: number;
  sessionId: string;
  worldSummary: string;
  player: PlayerState;
  turns: Turn[];
};
export type TurnResponse = { state: GameState };

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