export type GameState = {
  version: 1;
  sessionId: string;
  worldSummary: string;
  player: {
    name: string;
    hp: number;
    gold: number;
    inventory: string[];
    location: string;
  };
  log: { at: string; role: "user" | "gm"; text: string }[];
};

export function createNewState(sessionId: string): GameState {
  const now = new Date().toISOString();
  return {
    version: 1,
    sessionId,
    worldSummary: "Ты в начале приключения.",
    player: {
      name: "Герой",
      hp: 10,
      gold: 0,
      inventory: [],
      location: "Таверна",
    },
    log: [{ at: now, role: "gm", text: "Ты просыпаешься в таверне. Что делаешь?" }],
  };
}
