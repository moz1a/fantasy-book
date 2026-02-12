export type Choice = {
  id: string;
  text: string;
};

export type GameState = {
  version: 1;
  sessionId: string;
  worldSummary: string;
  prompt: string;
  choices: Choice[];
  player: {
    name: string;
    hp: number;
    gold: number;
    inventory: string[];
    location: string;
  };
  log: { role: "user" | "gm"; text: string }[];
};

export function createNewState(sessionId: string): GameState {
  return {
    version: 1,
    sessionId,
    worldSummary: "Ты просыпаешься в таверне.",
    prompt: "Что ты делаешь?",
    choices: [],
    player: {
      name: "Герой",
      hp: 10,
      gold: 0,
      inventory: [],
      location: "Таверна",
    },
    log: [{ role: "gm", text: "Ты просыпаешься в таверне. Что делаешь?" }],
  };
}
