type ApiError = { error?: string };

export type LogItem = { at: string; role: "user" | "gm"; text: string };

export type GameState = {
  sessionId: string;
  log: LogItem[];
};

export type TurnResponse = { state: GameState };

async function readJson(res: Response): Promise<unknown> {
  // Если бэк всегда отвечает JSON — этого достаточно.
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
  }); // POST JSON через fetch [web:176]

  const data = await readJson(res);

  if (!res.ok) throw new Error(errorMessage(data, `HTTP ${res.status}`));
  return data as TurnResponse;
}
