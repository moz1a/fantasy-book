/* eslint-disable @typescript-eslint/no-explicit-any */
export type TurnResponse = {
  state: {
    sessionId: string;
    log: { at: string; role: "user" | "gm"; text: string }[];
  };
};

export async function postTurn(params: { sessionId?: string; action: string }) {
  const res = await fetch("/api/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }); // fetch POST JSON пример [web:176]

  const data = (await res.json()) as any;

  if (!res.ok) {
    throw new Error(data?.error ?? `HTTP ${res.status}`);
  }

  return data as TurnResponse;
}
