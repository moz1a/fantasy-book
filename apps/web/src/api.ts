type ApiError = { error?: string };

export type LogItem = { at: string; role: "user" | "gm"; text: string };
export type Choice = { id: string; text: string };

export type PlayerState = {
  name: string;
  hp: number;
  gold: number;
  inventory: string[];
  location: string;
};

export type GameState = {
  version: 1;
  sessionId: string;
  worldSummary: string;
  prompt: string;
  choices: Choice[];
  player: PlayerState;
  log: LogItem[];
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
